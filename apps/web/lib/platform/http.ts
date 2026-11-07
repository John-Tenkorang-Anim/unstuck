/** Bounded JSON reading; compile-time types alone do not validate network data. */
export class PlatformUnavailable extends Error {
  constructor() {
    super("The shared notebook is temporarily unavailable.");
    this.name = "PlatformUnavailable";
  }
}
export async function readJson(
  response: Response,
  maxBytes: number,
): Promise<unknown> {
  if (
    !/^application\/(?:json|[a-z0-9!#$&^_.+-]+\+json)(?:\s*;|$)/i.test(
      response.headers.get("content-type") ?? "",
    )
  ) {
    await response.body?.cancel();
    throw new PlatformUnavailable();
  }
  const size = Number(response.headers.get("content-length"));
  if (Number.isFinite(size) && size > maxBytes) {
    await response.body?.cancel();
    throw new PlatformUnavailable();
  }
  if (!response.body) throw new PlatformUnavailable();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new PlatformUnavailable();
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    ) as unknown;
  } catch {
    throw new PlatformUnavailable();
  } finally {
    reader.releaseLock();
  }
}
