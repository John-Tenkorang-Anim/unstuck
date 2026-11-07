/** Isolated HTTP/SSR checks; no real API, accounts, uploads, or CDN are used. */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
const media = process.argv.includes("--media");
const children = [];
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
}
