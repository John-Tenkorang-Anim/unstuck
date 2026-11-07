import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const base = process.env.UNSTUCK_TEST_URL ?? "http://127.0.0.1:3100";
async function documentAt(path) {
  const response = await fetch(new URL(path, base));
  const document = new JSDOM(await response.text()).window.document;
  return { response, document };
}

test("discovery content is present in the HTML without running JavaScript", async () => {
  const { response, document } = await documentAt("/");
  assert.equal(response.status, 200);
  assert.match(document.querySelector("main h1").textContent, /Someone’s been/);
  assert.equal(document.querySelectorAll("main article").length, 6);
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

test("open questions contain only the matching entry on first render", async () => {
  const { document } = await documentAt("/questions");
  assert.equal(document.querySelectorAll("main article").length, 1);
  assert.match(
    document.querySelector("main article h3").textContent,
    /Can a room stay cooler/,
  );
});

test("secondary routes render and missing entries receive a real 404", async () => {
  for (const path of ["/about", "/notebook", "/new"]) {
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
