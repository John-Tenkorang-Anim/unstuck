/** Isolated HTTP/SSR checks; no real API, accounts, uploads, or CDN are used. */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestDatabase } from "./test-db.mjs";
const media = process.argv.includes("--media");
const children = [];
// Shared sessions write here; every run starts empty and cleans up after itself.
const dataDir = await mkdtemp(join(tmpdir(), "unstuck-data-"));
// The HTTP checks publish real sessions, so each run gets its own database.
const database = media ? undefined : await createTestDatabase();
// A one-line hash list with the reference PDQ of a sample photo, so the checks
// can prove a matching upload is refused and quarantined.
const hashList = join(dataDir, "hashes.txt");
await writeFile(
  hashList,
  "642f2df2364df3265b25819ae493bedc8a884c6627bc305fdb62c6fc648d90a9,test fixture\n",
);
async function start(args, url, env = {}) {
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  children.push(child);
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null)
      throw new Error("A test server exited before becoming ready");
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* Startup in progress. */
    }
    await delay(250);
  }
  throw new Error("A test server did not become ready");
}
try {
  if (media)
    await start(["scripts/fixture-api.mjs"], "http://127.0.0.1:3201/healthz");
  const port = media ? "3200" : "3100";
  await start(
    ["scripts/start.mjs", "--port", port],
    `http://127.0.0.1:${port}`,
    {
      UNSTUCK_API_URL: media ? "http://127.0.0.1:3201/api/v1" : "",
      UNSTUCK_MEDIA_ORIGIN: "",
      UNSTUCK_DATA_DIR: dataDir,
      DATABASE_URL: database?.url ?? "",
      UNSTUCK_MODERATOR_CODE: "test-moderator-code-2026",
      UNSTUCK_UPLOAD_REVIEW: "media",
      UNSTUCK_RATE_LIMIT_SCALE: "20",
      UNSTUCK_HASH_LIST: hashList,
    },
  );
  const tests = spawn(
    process.execPath,
    ["--test", media ? "tests/live-media.test.mjs" : "tests/server.test.mjs"],
    { stdio: "inherit" },
  );
  const [code] = await once(tests, "exit");
  if (code !== 0) throw new Error("Production HTTP checks failed");
} finally {
  for (const child of children.reverse()) {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
  }
  await rm(dataDir, { recursive: true, force: true });
  await database?.drop();
}
