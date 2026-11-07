import { currentAccount } from "@/lib/auth.server";
import { hasDatabase } from "@/lib/db.server";
import { storage } from "@/lib/storage.server";
import { fileById } from "@/lib/store.server";

export const dynamic = "force-dynamic";

/**
 * Serve an uploaded file with its sniffed type. Files waiting for review are
 * visible only to their owner and moderators. Rejected and quarantined files
 * are never served, to anyone. Nothing served here can run as a page.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const missing = () => new Response("Not found", { status: 404 });
  if (!hasDatabase() || !/^[0-9a-f-]{36}$/.test(id)) return missing();
  const file = await fileById(id).catch(() => undefined);
  if (!file || file.status === "rejected" || file.status === "blocked")
    return missing();
  if (file.status === "pending") {
    const viewer = await currentAccount();
    if (!viewer || (viewer.id !== file.owner && !viewer.moderator))
      return missing();
  }
  const size = file.bytes;
  const headers: Record<string, string> = {
    "Content-Type": file.mime,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control":
      file.status === "approved"
        ? "private, max-age=3600"
        : "private, no-store",
    "Accept-Ranges": "bytes",
    "Content-Disposition": `inline; filename="${file.id}"`,
  };
  const range = /bytes=(\d*)-(\d*)/.exec(request.headers.get("range") ?? "");
  let start = 0,
    end = size - 1,
    status = 200;
  if (range) {
    start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    end =
      range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size)
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  headers["Content-Length"] = String(end - start + 1);
  try {
    const { stream } = await storage().get(
      "files",
      id,
      range ? { start, end } : undefined,
    );
    return new Response(stream, { status, headers });
  } catch {
    return missing();
  }
}
