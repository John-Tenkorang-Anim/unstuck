import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
const base = "http://127.0.0.1:3200";
const path = "/entries/33333333-3333-4333-8333-333333333333";
async function read(path, headers = {}) {
  const response = await fetch(new URL(path, base), { headers });
  const html = await response.text();
  return { response, html, document: new JSDOM(html).window.document };
}

test("live entry HTML contains responsive images and native captioned video", async () => {
  const { response, document } = await read(path);
  assert.equal(response.status, 200);
  const image = document.querySelector(".media-image img");
  assert.equal(image.getAttribute("width"), "1600");
  assert.equal(image.getAttribute("height"), "1200");
  assert.equal(image.getAttribute("loading"), "lazy");
  assert.match(image.getAttribute("alt"), /Two clay pots/);
  const video = document.querySelector("video");
  assert.equal(video.getAttribute("preload"), "none");
  assert.ok(video.hasAttribute("controls"));
  assert.ok(!video.hasAttribute("autoplay"));
  assert.equal(video.querySelector("track").getAttribute("srclang"), "en");
  assert.match(
    document.querySelector(".media-transcript").textContent,
    /A smaller clay pot/,
  );
});

test("Save-Data is enforced before hydration; a full-reading cookie explicitly overrides it", async () => {
  const lite = await read(path, { "Save-Data": "on" });
  assert.equal(lite.response.status, 200);
  assert.equal(
    lite.document.querySelectorAll(
      ".media-gallery img, .media-gallery video, .media-gallery source, .media-gallery track",
    ).length,
    0,
  );
  assert.match(
    lite.document.querySelector(".media-gallery").textContent,
    /Load video/,
  );
  assert.match(
    lite.document.querySelector(".media-transcript").textContent,
    /Water darkens the sand/,
  );
  const full = await read(path, {
    "Save-Data": "on",
    Cookie: "unstuck-reading=full",
  });
  assert.ok(full.document.querySelector("video"));
});

test("unapproved and malformed attachments never expose their source paths", async () => {
  const pending = await read("/entries/pending-media");
  assert.equal(pending.response.status, 200);
  assert.equal(pending.document.querySelectorAll(".media-image img").length, 0);
  assert.ok(!pending.html.includes("/m/11111111-1111-4111-8111-111111111111/"));
  const broken = await read("/entries/broken-media");
  assert.equal(broken.response.status, 200);
  assert.ok(!broken.html.includes("orig/private-image"));
  assert.match(
    broken.document.querySelector(".story-body").textContent,
    /transcript preserves the details/,
  );
});

test("discovery sends only summaries to the interactive feed", async () => {
  const { response, html, document } = await read("/discover");
  assert.equal(response.status, 200);
  assert.equal(document.querySelectorAll("main article").length, 1);
  assert.ok(
    !html.includes(
      "The transcript preserves the details even without playback.",
    ),
  );
  assert.equal(document.querySelectorAll(".media-gallery").length, 0);
});

test("an upstream outage produces a server error instead of claiming an entry is missing", async () => {
  const { response } = await read("/entries/unavailable");
  assert.equal(response.status, 500);
});
