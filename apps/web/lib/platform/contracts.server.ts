import "server-only";
import { Ajv2020 } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import entrySchema from "../../../../contracts/api/entry-view-v1.json";
import mediaSchema from "../../../../contracts/media/public-manifest-v1.json";
import type { EntryView } from "../contracts/entry-v1";
import type { PublicMediaManifest } from "../contracts/media-v1";
import type { Attachment } from "../types";

const ajv = new Ajv2020({ strict: true, allErrors: false });
addFormats(ajv);
// Additive response fields may come from a newer server. Drop unknown fields
// before use; media manifests remain strict, explicitly versioned contracts.
const entryAjv = new Ajv2020({
  strict: true,
  allErrors: false,
  removeAdditional: true,
});
addFormats(entryAjv);
const isEntry = entryAjv.compile<EntryView>(entrySchema);
const isMedia = ajv.compile<PublicMediaManifest>(mediaSchema);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseMedia(
  value: unknown,
  id?: string,
): PublicMediaManifest | undefined {
  if (!isMedia(value) || (id !== undefined && value.id !== id))
    return undefined;
  const assets =
    value.kind === "image"
      ? value.sources
      : [
          ...value.sources,
          value.poster,
          ...value.captions,
          ...(value.described_source ? [value.described_source] : []),
        ];
  if (assets.some((asset) => !asset.path.startsWith(`/m/${value.id}/`)))
    return undefined;
  if (value.kind === "image") {
    if (
      !value.alt.trim() ||
      new Set(value.sources.map((s) => `${s.mime}:${s.width}`)).size !==
        value.sources.length
    )
      return undefined;
  } else {
    if (
      !value.title.trim() ||
      !value.descriptive_transcript.trim() ||
      (value.has_audio && !value.captions.length)
    )
      return undefined;
    if (
      value.sources.some((s) => s.width * s.height > 1280 * 720) ||
      (value.described_source &&
        value.described_source.width * value.described_source.height >
          1280 * 720)
    )
      return undefined;
    if (
      new Set(value.sources.map((s) => Math.min(s.width, s.height))).size !==
      value.sources.length
    )
      return undefined;
    if (
      new Set(value.captions.map((c) => c.language.toLowerCase())).size !==
      value.captions.length
    )
      return undefined;
  }
  return value;
}
export function parseAttachments(value: unknown): Attachment[] {
  if (!Array.isArray(value) || value.length > 32) return [];
  return value.flatMap((item): Attachment[] => {
    if (!record(item) || typeof item.id !== "string" || !uuid.test(item.id))
      return [];
    if (item.kind !== "image" && item.kind !== "video") return [];
    if (item.review_status !== "approved") {
      // Never pass private URLs, candidate manifests, or alt text into the client.
      return [
        {
          id: item.id,
          kind: item.kind,
          state:
            item.review_status === "rejected" ? "unavailable" : "processing",
        },
      ];
    }
    if (item.status !== "ready")
      return [
        {
          id: item.id,
          kind: item.kind,
          state: item.status === "failed" ? "unavailable" : "processing",
        },
      ];
    const manifest = parseMedia(item.manifest, item.id);
    if (!manifest || manifest.kind !== item.kind)
      return [{ id: item.id, kind: item.kind, state: "unavailable" }];
    return [{ id: item.id, kind: item.kind, state: "ready", manifest }];
  });
}
export function parseEntry(value: unknown): {
  record: EntryView;
  attachments: Attachment[];
} {
  if (!record(value)) throw new Error("Invalid entry response");
  // Validate the written entry independently; one failed attachment must not hide it.
  const { media: _rawMedia, ...fields } = value;
  const core = structuredClone({ ...fields, media: [] });
  if (!isEntry(core) || core.status !== "published")
    throw new Error("Invalid public entry response");
  return { record: core, attachments: parseAttachments(value.media) };
}
export function parseFeed(value: unknown) {
  if (!record(value) || !Array.isArray(value.items) || value.items.length > 100)
    throw new Error("Invalid feed response");
  return value.items.map(parseEntry);
}
