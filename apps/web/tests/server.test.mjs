import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { gzipSync } from "node:zlib";

const base = process.env.UNSTUCK_TEST_URL ?? "http://127.0.0.1:3100";
async function documentAt(path) {
  const response = await fetch(new URL(path, base));
  const document = new JSDOM(await response.text()).window.document;
  return { response, document };
}

test("discovery content is present in the HTML without running JavaScript", async () => {
  const { response, document } = await documentAt("/");
  assert.equal(response.status, 200);
  assert.match(
    document.querySelector("main h1").textContent,
    /Learn from what failed/,
  );
  assert.equal(document.querySelectorAll("main article").length, 7);
  assert.match(
    document.querySelector(".example-notice").textContent,
    /Fictional stories/,
  );
  assert.ok(document.querySelector('a.skip-link[href="#main"]'));
});

test("the complete field note and its context are readable without JavaScript", async () => {
  const { response, document } = await documentAt(
    "/entries/two-pots-one-small-breakthrough",
  );
  assert.equal(response.status, 200);
  assert.match(document.querySelector("main h1").textContent, /Two clay pots/);
  assert.equal(document.querySelectorAll(".story-body > section").length, 4);
  assert.match(document.querySelector(".context-panel").textContent, /Ghana/);
  assert.match(
    document.querySelector(".sample-banner").textContent,
    /fictional/,
  );
  assert.equal(document.querySelectorAll(".evidence-row").length, 2);
});

test("search results, video moments and their evidence render without JavaScript", async () => {
  const { response, document } = await documentAt("/search?q=bridge+twisting");
  assert.equal(response.status, 200);
  const first = document.querySelector(".result h2 a");
  assert.match(first.textContent, /Tacoma Narrows/);
  assert.match(
    document.querySelector(".serp-moments a").getAttribute("href"),
    /\/entries\/tacoma-narrows-1940\?t=\d+#clip/,
  );
  assert.match(
    document.querySelector(".evidence").textContent,
    /Where it broke/,
  );
  assert.ok(document.querySelector(".result mark"));
});

test("critique sessions and their pinned feedback render without JavaScript", async () => {
  const { response, document } = await documentAt(
    "/sessions/first-print-spaghetti",
  );
  assert.equal(response.status, 200);
  assert.equal(document.querySelectorAll(".canvas-frame .pin").length, 3);
  assert.ok(document.querySelectorAll(".note").length >= 4);
  const missing = await fetch(new URL("/sessions/not-a-session", base));
  assert.equal(missing.status, 404);
});

test("open questions contain only the matching entry on first render", async () => {
  const { document } = await documentAt("/questions");
  assert.equal(document.querySelectorAll("main article").length, 1);
  assert.match(
    document.querySelector("main article h3").textContent,
    /Can a room stay cooler/,
  );
});

test("secondary routes render and missing entries receive a real 404", async () => {
  for (const path of [
    "/about",
    "/notebook",
    "/new",
    "/search",
    "/sessions",
    "/sessions/new",
  ]) {
    const { response, document } = await documentAt(path);
    assert.equal(response.status, 200, path);
    assert.ok(document.querySelector("main h1"), path);
  }
  const { response, document } = await documentAt(
    "/entries/missing-field-note",
  );
  assert.equal(response.status, 404);
  assert.match(
    document.querySelector('meta[name="robots"]').content,
    /noindex/,
  );
});

test("a readable entry document stays within the 50 KB compressed HTML budget", async () => {
  const response = await fetch(
    new URL("/entries/two-pots-one-small-breakthrough", base),
  );
  assert.equal(response.status, 200);
  const bytes = gzipSync(await response.text()).byteLength;
  assert.ok(
    bytes <= 50 * 1024,
    `Entry document grew to ${bytes} compressed bytes`,
  );
});
