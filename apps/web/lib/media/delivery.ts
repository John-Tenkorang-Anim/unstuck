import type { ImageAsset, VideoAsset } from "../contracts/media-v1";
/** Delivery paths cannot refer to originals, arbitrary URLs, or application routes. */
export function mediaUrl(path: string, origin = "") {
  if (!/^\/m\/[0-9a-f-]{36}\/[A-Za-z0-9][A-Za-z0-9._-]*$/i.test(path))
    throw new Error("Invalid public media path");
  if (!origin) return path;
  const parsed = new URL(origin);
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  )
    throw new Error("Media origin must be a bare HTTPS origin");
  return `${parsed.origin}${path}`;
}
export function imageSources(sources: ImageAsset[]) {
  return [...sources].sort((a, b) => a.width - b.width);
}
export function videoSources(sources: VideoAsset[]) {
  return [...sources].sort(
    (a, b) => Math.min(a.width, a.height) - Math.min(b.width, b.height),
  );
}
export function formatBytes(bytes: number) {
  return bytes < 1_000_000
    ? `${Math.max(1, Math.round(bytes / 1000))} KB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`;
}
