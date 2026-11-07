import "server-only";
import { readFile, stat } from "node:fs/promises";
import { hamming } from "./pdq";

/**
 * A list of PDQ hashes of known abuse imagery, as distributed by industry
 * hash-sharing programmes. UNSTUCK_HASH_LIST points to a text file with one
 * 64-character hex hash per line, optionally followed by a comma and a label.
 * Lines starting with # are ignored. The file is reloaded when it changes.
 */
type Entry = { hex: string; label: string };
const shared = globalThis as typeof globalThis & {
  __unstuckHashList?: { path: string; mtime: number; entries: Entry[] };
};
async function load(): Promise<Entry[]> {
  const path = process.env.UNSTUCK_HASH_LIST;
  if (!path) return [];
  const mtime = (await stat(path)).mtimeMs;
  const cached = shared.__unstuckHashList;
  if (cached && cached.path === path && cached.mtime === mtime)
    return cached.entries;
  const entries = (await readFile(path, "utf8"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [hex, ...label] = line.split(",");
      return {
        hex: hex.trim().toLowerCase(),
        label: label.join(",").trim() || "listed hash",
      };
    })
    .filter((entry) => /^[0-9a-f]{64}$/.test(entry.hex));
  shared.__unstuckHashList = { path, mtime, entries };
  return entries;
}
export const hashListConfigured = () => !!process.env.UNSTUCK_HASH_LIST;
/** The closest listed hash within the threshold (31 by default), if any. */
export async function matchHash(hex: string) {
  const threshold = Number(process.env.UNSTUCK_HASH_THRESHOLD || 31);
  let best: { label: string; distance: number } | undefined;
  for (const entry of await load()) {
    const distance = hamming(hex, entry.hex);
    if (distance <= threshold && (!best || distance < best.distance))
      best = { label: entry.label, distance };
  }
  return best;
}
