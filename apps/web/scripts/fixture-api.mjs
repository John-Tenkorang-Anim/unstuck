/** Test-only API: loopback, synthetic public entries, no uploads or writes. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
const entry = JSON.parse(
  await readFile(
    new URL("../../../contracts/media/fixtures/entry-v1.json", import.meta.url),
    "utf8",
  ),
);
const server = createServer((request, response) => {
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") {
    response.writeHead(405).end("{}");
    return;
  }
  if (request.url === "/healthz") {
    response.end('{"ok":true}');
    return;
  }
  if (request.url === "/api/v1/feed") {
    response.end(JSON.stringify({ items: [entry], next_cursor: null }));
    return;
  }
  if (request.url === "/api/v1/entries/pending-media") {
    const pending = structuredClone(entry);
    pending.media[0].review_status = "pending_review";
    response.end(JSON.stringify(pending));
    return;
  }
  if (request.url === "/api/v1/entries/broken-media") {
    const broken = structuredClone(entry);
    broken.media[0].manifest.sources[0].path = "orig/private-image";
    response.end(JSON.stringify(broken));
    return;
  }
  if (request.url === `/api/v1/entries/${entry.id}`) {
    response.end(JSON.stringify(entry));
    return;
  }
  if (request.url === "/api/v1/entries/unavailable") {
    response.writeHead(503).end("{}");
    return;
  }
  response.writeHead(404).end("{}");
});
server.listen(3201, "127.0.0.1");
