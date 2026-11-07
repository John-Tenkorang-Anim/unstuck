import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Block, Pin, Session, SessionNote, SessionStatus } from "./sessions";
import type { Moment } from "./types";

/**
 * A small file-backed store for shared sessions, notes, accounts and uploads.
 * It is built for one web process: writes are serialised in memory and each
 * save replaces the database file atomically. Uploaded files live outside the
 * public folder and are only served through a route that sets safe headers.
 */
export interface Account {
  id: string;
  name: string;
  role: string;
  tokenHash: string;
  created: string;
}
export interface StoredFile {
  id: string;
  owner: string;
  mime: string;
  bytes: number;
  name: string;
  created: string;
}
export interface SharedSession extends Session {
  owner: string;
  created: string;
  media?: {
    kind: "image" | "video" | "pdf";
    file: string;
    width?: number;
    height?: number;
    alt: string;
    moments?: Moment[];
    duration?: number;
  };
}
export interface StoredNote extends SessionNote {
  sessionId: string;
  owner: string;
  created: string;
  page?: number;
}
interface Data {
  accounts: Account[];
  sessions: SharedSession[];
  notes: StoredNote[];
  files: StoredFile[];
  /** Extra pins and status changes on sample sessions, keyed by session id. */
  overlays: Record<string, { pins: Pin[]; status?: SessionStatus }>;
}
const empty = (): Data => ({ accounts: [], sessions: [], notes: [], files: [], overlays: {} });

export const dataDir = () => resolve(process.env.UNSTUCK_DATA_DIR || join(process.cwd(), ".data"));
let cache: Data | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<Data> {
  if (cache) return cache;
  try {
    cache = { ...empty(), ...JSON.parse(await readFile(join(dataDir(), "db.json"), "utf8")) };
  } catch {
    cache = empty();
  }
  return cache!;
}
export async function read<T>(view: (data: Data) => T): Promise<T> {
  return view(await load());
}
/** Run a change against the store and persist it before anyone else writes. */
export function write<T>(change: (data: Data) => T): Promise<T> {
  const run = queue.then(async () => {
    const data = await load();
    const result = change(data);
    await mkdir(dataDir(), { recursive: true });
    const target = join(dataDir(), "db.json");
    const temp = `${target}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(data));
    await rename(temp, target);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function newToken() {
  return randomBytes(32).toString("base64url");
}
export const newId = () => randomUUID();

const signatures: { mime: string; kind: "image" | "video" | "pdf"; test: (b: Buffer) => boolean }[] = [
  { mime: "image/jpeg", kind: "image", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", kind: "image", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", kind: "image", test: (b) => b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP" },
  { mime: "video/mp4", kind: "video", test: (b) => b.toString("latin1", 4, 8) === "ftyp" },
  { mime: "video/webm", kind: "video", test: (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) },
  { mime: "application/pdf", kind: "pdf", test: (b) => b.toString("latin1", 0, 5) === "%PDF-" },
];
export const sizeLimits = { image: 15e6, video: 100e6, pdf: 20e6 };

/** Identify a file by its first bytes, never by its name or declared type. */
export function sniff(bytes: Buffer) {
  return signatures.find((s) => s.test(bytes));
}
export async function saveFile(owner: string, name: string, bytes: Buffer) {
  const kind = sniff(bytes);
  if (!kind) throw new StoreError("Only JPEG, PNG, WebP, MP4, WebM and PDF files can be shared.");
  if (bytes.length > sizeLimits[kind.kind])
    throw new StoreError(`That ${kind.kind === "pdf" ? "PDF" : kind.kind} is over the size limit.`);
  const file: StoredFile = {
    id: newId(),
    owner,
    mime: kind.mime,
    bytes: bytes.length,
    name: name.slice(0, 120),
    created: new Date().toISOString(),
  };
  await mkdir(join(dataDir(), "files"), { recursive: true });
  await writeFile(join(dataDir(), "files", file.id), bytes);
  await write((data) => data.files.push(file));
  return { file, kind: kind.kind };
}
export const filePath = (id: string) => join(dataDir(), "files", id);

export class StoreError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const text = (value: unknown, min: number, max: number, label: string) => {
  const s = typeof value === "string" ? value.trim() : "";
  if (s.length < min) throw new StoreError(`${label} is too short.`);
  if (s.length > max) throw new StoreError(`${label} is too long.`);
  return s;
};
export const clean = { text };

/** Validate shown working from a client before it is stored. */
export function cleanBlocks(value: unknown): Block[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 6) throw new StoreError("Too many working blocks.");
  return value.map((raw): Block => {
    const b = raw as Record<string, unknown>;
    const title = text(b.title, 1, 80, "A block title");
    if (b.kind === "steps") {
      if (!Array.isArray(b.steps) || !b.steps.length || b.steps.length > 40)
        throw new StoreError("Steps need between 1 and 40 entries.");
      return { kind: "steps", title, steps: b.steps.map((s) => text(s, 1, 2000, "A step")) };
    }
    if (b.kind === "code")
      return {
        kind: "code",
        title,
        language: text(b.language || "Code", 1, 40, "The language"),
        code: text(b.code, 1, 20000, "The code"),
        output: typeof b.output === "string" ? b.output.slice(0, 5000) : undefined,
        expected: typeof b.expected === "string" ? b.expected.slice(0, 5000) : undefined,
      };
    if (b.kind === "data") {
      const csv = text(b.csv, 3, 20000, "The data");
      const rows = csv.split(/\r?\n/);
      if (rows.length > 201 || rows.some((r) => r.split(",").length > 20))
        throw new StoreError("Data tables can have up to 200 rows and 20 columns.");
      return { kind: "data", title, csv, note: typeof b.note === "string" ? b.note.slice(0, 300) : undefined };
    }
    throw new StoreError("Unknown working block.");
  });
}
export function cleanPins(value: unknown): Pin[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) throw new StoreError("Too many pins.");
  return value.map((raw, i) => cleanPin(raw, `p${i + 1}`));
}
export function cleanPin(raw: unknown, id: string): Pin & { page?: number } {
  const p = raw as Record<string, unknown>;
  const x = Number(p.x),
    y = Number(p.y);
  if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) throw new StoreError("A pin is outside the work.");
  const page = p.page === undefined ? undefined : Number(p.page);
  if (page !== undefined && !(Number.isInteger(page) && page >= 1 && page <= 500))
    throw new StoreError("A pin is on an unknown page.");
  return { id, x, y, label: text(p.label || "Pinned spot", 1, 120, "A pin label"), ...(page ? { page } : {}) };
}
export function cleanMoments(value: unknown): Moment[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) throw new StoreError("Too many marked moments.");
  return value.map((raw) => {
    const m = raw as Record<string, unknown>;
    const at = Number(m.at);
    if (!(at >= 0 && at <= 3600)) throw new StoreError("A moment is outside the video.");
    const kind = m.kind === "worked" || m.kind === "note" ? m.kind : "broke";
    return { at, kind, label: text(m.label || "Marked moment", 1, 160, "A moment label") };
  });
}
