import "server-only";
import { cookies, headers } from "next/headers";
import { readingPolicy } from "./reading-policy";
export async function getReadingPolicy() {
  const [jar, request] = await Promise.all([cookies(), headers()]);
  return readingPolicy(
    jar.get("unstuck-reading")?.value,
    request.get("save-data"),
    request.get("ect"),
  );
}
export function getMediaOrigin() {
  const value = process.env.UNSTUCK_MEDIA_ORIGIN;
  if (!value) return "";
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("UNSTUCK_MEDIA_ORIGIN must be a bare HTTPS origin");
  return url.origin;
}
