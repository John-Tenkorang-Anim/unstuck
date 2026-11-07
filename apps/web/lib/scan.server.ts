import "server-only";
import sharp from "sharp";
import { StoreError } from "./errors.server";
import { matchHash } from "./hashlist.server";
import { pdqFromRgb } from "./pdq";

export type Kind = "image" | "video" | "pdf";
export interface ScanResult {
  bytes: Buffer;
  status: "approved" | "pending";
  note: string;
  pdq?: string;
}
/** Thrown when an image matches a known-abuse hash. The upload must be quarantined. */
export class HashMatch extends Error {
  constructor(
    readonly pdq: string,
    readonly label: string,
    readonly distance: number,
  ) {
    super("hash match");
  }
}
/** PDQ of an image, computed on at most 2048 pixels along its longest side. */
export async function imagePdq(bytes: Buffer) {
  const { data, info } = await sharp(bytes, { limitInputPixels: 60_000_000 })
    .rotate()
    .resize({
      width: 2048,
      height: 2048,
      fit: "inside",
      withoutEnlargement: true,
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return pdqFromRgb(new Uint8Array(data), info.height, info.width).hex;
}
/** PDF features that can run code, open other files or hide content. */
const activePdf =
  /\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|XFA|AA|OpenAction|SubmitForm|ImportData)\b/;

/**
 * Check an upload before anyone else can see it:
 * - Images are fully decoded and re-encoded. That rejects malformed or
 *   disguised files and drops metadata such as GPS location. Their PDQ hash is
 *   checked against UNSTUCK_HASH_LIST and kept for later re-checks.
 * - PDFs with scripts, launch actions, embedded files or forms are refused.
 * - An external scanner (for malware or known abuse imagery) runs when
 *   UNSTUCK_SCAN_URL is set. It answers {"verdict": "clean" | "review" | "block"}.
 * - UNSTUCK_UPLOAD_REVIEW decides what waits for a moderator: "all", "media"
 *   (video and PDF), or "none". It defaults to "all" in production.
 */
export async function scan(
  kind: Kind,
  mime: string,
  input: Buffer,
): Promise<ScanResult> {
  let bytes = input;
  let pdq: string | undefined;
  const notes: string[] = [];
  if (kind === "image") {
    try {
      const image = sharp(input, {
        failOn: "error",
        limitInputPixels: 60_000_000,
      }).rotate();
      bytes =
        mime === "image/png"
          ? await image.png().toBuffer()
          : mime === "image/webp"
            ? await image.webp({ quality: 88 }).toBuffer()
            : await image.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
      notes.push("re-encoded, metadata removed");
    } catch {
      throw new StoreError(
        "That image couldn’t be read. Try exporting it again as JPEG or PNG.",
      );
    }
    pdq = await imagePdq(bytes);
    const match = await matchHash(pdq);
    if (match) throw new HashMatch(pdq, match.label, match.distance);
  }
  if (kind === "pdf" && activePdf.test(input.toString("latin1")))
    throw new StoreError(
      "PDFs with scripts, forms, embedded files or automatic actions can’t be shared.",
    );
  let verdict: "clean" | "review" = "clean";
  const scanner = process.env.UNSTUCK_SCAN_URL;
  if (scanner) {
    try {
      const response = await fetch(scanner, {
        method: "POST",
        headers: { "Content-Type": mime },
        body: new Uint8Array(bytes),
        signal: AbortSignal.timeout(20_000),
      });
      const result = (await response.json()) as { verdict?: string };
      if (result.verdict === "block")
        throw new StoreError("This file can’t be shared.");
      verdict = result.verdict === "clean" ? "clean" : "review";
      notes.push(`scanner: ${result.verdict ?? "no verdict"}`);
    } catch (error) {
      if (error instanceof StoreError) throw error;
      verdict = "review";
      notes.push("scanner unavailable");
    }
  }
  const policy =
    process.env.UNSTUCK_UPLOAD_REVIEW ??
    (process.env.NODE_ENV === "production" ? "all" : "none");
  const held =
    verdict === "review" ||
    policy === "all" ||
    (policy === "media" && kind !== "image");
  return {
    bytes,
    status: held ? "pending" : "approved",
    note: notes.join("; "),
    pdq,
  };
}
