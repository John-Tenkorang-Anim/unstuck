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
  const { response, document } = await documentAt("/discover");
  assert.equal(response.status, 200);
  assert.match(
    document.querySelector("main h1").textContent,
    /Learn from what failed/,
  );
  assert.ok(document.querySelectorAll("main article").length >= 7);
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
  assert.match(
    document.querySelector("main h1").textContent,
    /Clay pot cooler/,
  );
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

test("open questions are listed with their answer counts on first render", async () => {
  const { document } = await documentAt("/questions");
  const titles = [...document.querySelectorAll(".q-row h3")].map(
    (h) => h.textContent,
  );
  assert.ok(titles.some((t) => /keep a west-facing room cooler/.test(t)));
  assert.equal(document.querySelectorAll("main article").length, 0);
  assert.ok(document.querySelector(".q-row .q-count"));
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

// A 1×1 PNG, and an HTML page pretending to be one.
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
async function post(path, body, cookie = "", extra = {}) {
  const isForm = body instanceof FormData;
  return fetch(new URL(path, base), {
    method: "POST",
    headers: {
      Origin: base,
      ...(isForm ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...extra,
    },
    body: isForm ? body : JSON.stringify(body),
  });
}
function sessionForm(file, name = "work.png") {
  const form = new FormData();
  form.set(
    "session",
    JSON.stringify({
      title: "My LED never lights up",
      field: "Making & fixing",
      specialty: "Electronics",
      mode: "hints",
      wentWrong: "Nothing lights when I connect the battery.",
      ask: "Is the LED the wrong way round?",
      alt: "A breadboard with one LED and a resistor",
      width: 1,
      height: 1,
      pins: [{ x: 0.5, y: 0.5, label: "The LED" }],
      blocks: [
        { kind: "data", title: "Readings", csv: "Volts,Milliamps\n3,0\n5,0" },
      ],
    }),
  );
  form.set("work", new Blob([file]), name);
  return form;
}

test("people can publish a session with a file and others can pin feedback on it", async () => {
  assert.equal((await post("/api/sessions", sessionForm(png))).status, 401);
  const signup = await post("/api/account", {
    name: "Ama",
    role: "Electronics student",
  });
  assert.equal(signup.status, 201);
  const cookie = signup.headers.get("set-cookie").split(";")[0];
  assert.match(signup.headers.get("set-cookie"), /HttpOnly/i);
  const created = await post("/api/sessions", sessionForm(png), cookie);
  assert.equal(created.status, 201);
  const { id } = await created.json();

  const reviewer = (
    await post("/api/account", { name: "Kofi", role: "Technician" })
  ).headers
    .get("set-cookie")
    .split(";")[0];
  const note = await post(
    `/api/sessions/${id}/notes`,
    {
      type: "issue",
      body: "The flat edge of the LED should face ground.",
      pin: { x: 0.4, y: 0.6 },
    },
    reviewer,
  );
  assert.equal(note.status, 201);
  const rowNote = await post(
    `/api/sessions/${id}/notes`,
    {
      type: "question",
      body: "Is row 2 measured at the LED?",
      anchor: "row:2",
    },
    reviewer,
  );
  assert.equal(rowNote.status, 201);
  const badAnchor = await post(
    `/api/sessions/${id}/notes`,
    { type: "question", body: "What about row 9?", anchor: "row:9" },
    reviewer,
  );
  assert.equal(badAnchor.status, 400);
  assert.equal(
    (await post(`/api/sessions/${id}/status`, { status: "resolved" }, reviewer))
      .status,
    403,
  );
  assert.equal(
    (await post(`/api/sessions/${id}/status`, { status: "revised" }, cookie))
      .status,
    200,
  );

  // Pages and API routes are separate bundles; both must see the new session.
  const { document } = await documentAt(`/sessions/${id}`);
  assert.match(
    document.querySelector("main h1").textContent,
    /My LED never lights up/,
  );
  assert.match(
    document.querySelector(".session-notes").textContent,
    /flat edge of the LED/,
  );
  assert.match(
    document.querySelector(".hints-banner").textContent,
    /hints only/,
  );
  assert.equal(document.querySelectorAll(".canvas-frame .pin").length, 2);
  assert.equal(document.querySelectorAll(".data-table tbody tr").length, 2);

  const src = document.querySelector(".canvas-frame img").getAttribute("src");
  const file = await fetch(new URL(src, base));
  assert.equal(file.headers.get("content-type"), "image/png");
  assert.equal(file.headers.get("x-content-type-options"), "nosniff");
  assert.match(file.headers.get("content-security-policy"), /sandbox/);
  const { document: list } = await documentAt("/sessions");
  assert.match(
    list.querySelector(".session-cards").textContent,
    /My LED never lights up/,
  );
  const { document: found } = await documentAt("/search?q=LED+battery");
  assert.match(
    found.querySelector(".result h2").textContent,
    /My LED never lights up/,
  );
});

test("uploads are identified by their contents, and writes must come from this site", async () => {
  const cookie = (await post("/api/account", { name: "Esi" })).headers
    .get("set-cookie")
    .split(";")[0];
  const disguised = await post(
    "/api/sessions",
    sessionForm(Buffer.from("<html><script>alert(1)</script>"), "work.png"),
    cookie,
  );
  assert.equal(disguised.status, 400);
  assert.match((await disguised.json()).error, /Only JPEG, PNG/);
  const crossSite = await post("/api/account", { name: "Mallory" }, "", {
    Origin: "https://evil.example",
  });
  assert.equal(crossSite.status, 403);
  assert.equal(
    (
      await fetch(
        new URL("/api/files/00000000-0000-0000-0000-000000000000", base),
      )
    ).status,
    404,
  );
});

const json = async (response) => ({
  status: response.status,
  body: await response.json(),
});
const cookieOf = (response) => response.headers.get("set-cookie").split(";")[0];

test("a recovery code signs the same account in on another device", async () => {
  const created = await post("/api/account", { name: "Abena", role: "Nurse" });
  const { body } = await json(created);
  assert.match(body.recovery, /^[A-Z0-9]{4}(-[A-Z0-9]{4}){4}$/);
  const other = await post("/api/account/recover", {
    code: body.recovery.toLowerCase(),
  });
  assert.equal(other.status, 200);
  const me = await fetch(new URL("/api/account", base), {
    headers: { Cookie: cookieOf(other) },
  });
  assert.equal((await me.json()).account.name, "Abena");
  assert.equal(
    (await post("/api/account/recover", { code: "AAAA-BBBB-CCCC-DDDD-EEEE" }))
      .status,
    400,
  );
});

test("three reports hide a session until a moderator restores it with a reason", async () => {
  const author = cookieOf(await post("/api/account", { name: "Owner" }));
  const form = sessionForm(png);
  const { body } = await json(await post("/api/sessions", form, author));
  const id = body.id;
  for (const name of ["Rep one", "Rep two", "Rep three"]) {
    const reporter = cookieOf(await post("/api/account", { name }));
    assert.equal(
      (
        await post(
          "/api/reports",
          { type: "session", id, reason: "Spam" },
          reporter,
        )
      ).status,
      201,
    );
  }
  assert.equal((await fetch(new URL(`/sessions/${id}`, base))).status, 404);
  assert.equal(
    (
      await fetch(new URL(`/sessions/${id}`, base), {
        headers: { Cookie: author },
      })
    ).status,
    200,
  );

  const mod = cookieOf(await post("/api/account", { name: "Moderator" }));
  assert.equal(
    (await post("/api/account/moderator", { code: "wrong-code-entirely" }, mod))
      .status,
    403,
  );
  assert.equal(
    (
      await post(
        "/api/account/moderator",
        { code: "test-moderator-code-2026" },
        mod,
      )
    ).status,
    200,
  );
  const queue = await fetch(new URL("/moderation", base), {
    headers: { Cookie: mod },
  });
  const queueText = new JSDOM(await queue.text()).window.document.querySelector(
    "main",
  ).textContent;
  assert.match(queueText, /3 reports/);
  assert.equal(
    (
      await post(
        "/api/moderation",
        {
          action: "restore",
          type: "session",
          id,
          note: "Checked: genuine question.",
        },
        author,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await post(
        "/api/moderation",
        {
          action: "restore",
          type: "session",
          id,
          note: "Checked: genuine question.",
        },
        mod,
      )
    ).status,
    200,
  );
  assert.equal((await fetch(new URL(`/sessions/${id}`, base))).status, 200);
});

test("PDFs wait for review: only the owner and moderators see them until approved", async () => {
  const owner = cookieOf(await post("/api/account", { name: "Pdf owner" }));
  const form = sessionForm(
    Buffer.from("%PDF-1.4\n% a plain lab report\n"),
    "lab.pdf",
  );
  const { body } = await json(await post("/api/sessions", form, owner));
  const { document: mine } = await (async () => {
    const response = await fetch(new URL(`/sessions/${body.id}`, base), {
      headers: { Cookie: owner },
    });
    return { document: new JSDOM(await response.text()).window.document };
  })();
  assert.match(
    mine.querySelector(".review-notice").textContent,
    /waiting for a moderator/,
  );
  const { document: theirs } = await documentAt(`/sessions/${body.id}`);
  assert.match(
    theirs.querySelector(".review-notice").textContent,
    /waiting for review/,
  );
  assert.equal(theirs.querySelector(".pdf"), null);
});

test("field notes can be published with a photo and appear in the feed and search", async () => {
  const writer = cookieOf(
    await post("/api/account", { name: "Farmer Yaa", role: "Smallholder" }),
  );
  const form = new FormData();
  form.set(
    "entry",
    JSON.stringify({
      kind: "experience",
      template: "farming_food",
      title: "Shade cloth saved my seedlings",
      goal: "Keep tomato seedlings alive through a dry spell.",
      approach: "Hung 50% shade cloth over the nursery bed.",
      result: "Losses dropped from about half to almost none.",
      outcome: "worked",
      advice: "Water at dawn as well.",
      country: "GH",
    }),
  );
  form.set(
    "media",
    JSON.stringify([
      { alt: "Seedlings under green shade cloth", width: 1, height: 1 },
    ]),
  );
  form.set("file-0", new Blob([png]), "nursery.png");
  const created = await post("/api/entries", form, writer);
  assert.equal(created.status, 201);
  const { id } = await created.json();
  const { document } = await documentAt(`/entries/${id}`);
  assert.match(
    document.querySelector("main h1").textContent,
    /Shade cloth saved my seedlings/,
  );
  assert.equal(document.querySelectorAll(".story-body > section").length, 4);
  assert.ok(document.querySelector(".story-photo img, #photo img"));
  const { document: home } = await documentAt("/discover");
  assert.match(
    home.querySelector(".tiles").textContent,
    /Shade cloth saved my seedlings/,
  );
  const { document: found } = await documentAt(
    "/search?q=shade+cloth+seedlings",
  );
  assert.match(found.querySelector(".result h2").textContent, /Shade cloth/);
});

test("an upload matching the hash list is refused, its uploader suspended, and moderators alerted", async () => {
  const { readFile } = await import("node:fs/promises");
  const photo = await readFile(
    new URL("../public/samples/solder-640.jpg", import.meta.url),
  );
  const uploader = cookieOf(
    await post("/api/account", { name: "Matched uploader" }),
  );
  const refused = await post(
    "/api/sessions",
    sessionForm(photo, "joint.jpg"),
    uploader,
  );
  assert.equal(refused.status, 400);
  assert.equal((await refused.json()).error, "This file can’t be shared.");
  const again = await post("/api/sessions", sessionForm(png), uploader);
  assert.equal(again.status, 403);
  assert.equal(
    (
      await post(
        "/api/appeals",
        { type: "account", id: "x", statement: "short" },
        uploader,
      )
    ).status,
    400,
  );
  const mod = cookieOf(
    await post("/api/account", { name: "Incident moderator" }),
  );
  await post(
    "/api/account/moderator",
    { code: "test-moderator-code-2026" },
    mod,
  );
  const page = await fetch(new URL("/moderation", base), {
    headers: { Cookie: mod },
  });
  const text = new JSDOM(await page.text()).window.document.querySelector(
    "main",
  ).textContent;
  assert.match(text, /Matched known abuse imagery/);
  assert.match(text, /Matched uploader/);
  assert.match(text, /NCMEC CyberTipline/);
});

test("an owner can appeal a hidden session and a moderator can restore it", async () => {
  const owner = cookieOf(
    await post("/api/account", { name: "Appealing owner" }),
  );
  const { body } = await json(
    await post("/api/sessions", sessionForm(png), owner),
  );
  for (const name of ["Flagger one", "Flagger two", "Flagger three"]) {
    const reporter = cookieOf(await post("/api/account", { name }));
    await post(
      "/api/reports",
      { type: "session", id: body.id, reason: "Spam" },
      reporter,
    );
  }
  const account = await fetch(new URL("/account", base), {
    headers: { Cookie: owner },
  });
  const standing = new JSDOM(
    await account.text(),
  ).window.document.querySelector("#standing").textContent;
  assert.match(standing, /Hidden automatically after 3 people reported it/);
  assert.equal(
    (
      await post(
        "/api/appeals",
        {
          type: "session",
          id: body.id,
          statement:
            "This is my genuine coursework question, please look again.",
        },
        owner,
      )
    ).status,
    201,
  );
  const mod = cookieOf(
    await post("/api/account", { name: "Appeal moderator" }),
  );
  await post(
    "/api/account/moderator",
    { code: "test-moderator-code-2026" },
    mod,
  );
  const queue = await fetch(new URL("/moderation", base), {
    headers: { Cookie: mod },
  });
  const html = await queue.text();
  const appealId = /\/api\/appeals\/([0-9a-f-]{36})\/decide/.exec(html)?.[1];
  assert.ok(appealId, "the appeal is listed for moderators");
  assert.equal(
    (
      await post(
        `/api/appeals/${appealId}/decide`,
        { decision: "overturn", note: "Reviewed: a genuine question." },
        mod,
      )
    ).status,
    200,
  );
  assert.equal(
    (await fetch(new URL(`/sessions/${body.id}`, base))).status,
    200,
  );
});

test("people respond to a field note, mark answers helpful, and the poster sees what changed", async () => {
  const entry = "a-cooler-room-without-a-bigger-bill";
  const asker = cookieOf(await post("/api/account", { name: "Kofi" }));
  const helper = cookieOf(await post("/api/account", { name: "Efua" }));
  const signedOut = await post(`/api/entries/${entry}/comments`, {
    kind: "comment",
    body: "Hello",
  });
  assert.equal(signedOut.status, 401);
  const asked = await post(
    `/api/entries/${entry}/comments`,
    { kind: "question", body: "Which way do your windows face?" },
    asker,
  );
  assert.equal(asked.status, 201);
  const { id } = await asked.json();
  const reply = await post(
    `/api/entries/${entry}/comments`,
    { kind: "comment", body: "West, mostly.", parentId: id },
    helper,
  );
  assert.equal(reply.status, 201);
  assert.equal(
    (await post(`/api/comments/${id}/helpful`, {}, asker)).status,
    400,
  );
  const helped = await post(`/api/comments/${id}/helpful`, {}, helper);
  assert.deepEqual(await helped.json(), { helped: true, helpful: 1 });
  const page = await (
    await fetch(
      new URL(`/api/entries/${entry}/discussion?view=questions`, base),
    )
  ).json();
  const mine = page.items.find((c) => c.id === id);
  assert.equal(mine.replies, 1);
  assert.equal(mine.helpful, 1);
  const replies = await (
    await fetch(new URL(`/api/comments/${id}/replies`, base))
  ).json();
  assert.equal(replies.items[0].body, "West, mostly.");
  const { document } = await documentAt(`/entries/${entry}`);
  assert.match(document.querySelector("#why").textContent, /responses? from/);
  assert.equal(
    (
      await post(
        `/api/entries/${entry}/comments`,
        { kind: "supports", body: "Evidence", explanationId: "sample-99" },
        helper,
      )
    ).status,
    400,
  );
});

test("people start and join communities, and ask a question there only", async () => {
  const founder = cookieOf(await post("/api/account", { name: "Esi" }));
  const created = await post(
    "/api/communities",
    {
      name: "Solar dryers",
      about: "Drying fruit and fish with sunlight, and what spoiled.",
      topic: "Food & farming",
      rules: ["Say what you dried and for how long."],
    },
    founder,
  );
  assert.equal(created.status, 201);
  const { slug } = await created.json();
  assert.equal(slug, "solar-dryers");
  const again = await post(
    "/api/communities",
    {
      name: "Solar Dryers!",
      about: "A second one with the same name.",
      topic: "Food & farming",
      rules: ["Be kind."],
    },
    founder,
  );
  assert.equal(again.status, 400);
  const member = cookieOf(await post("/api/account", { name: "Yaw" }));
  const refused = await post(
    `/api/communities/${slug}/membership`,
    { join: true },
    member,
  );
  assert.equal(refused.status, 400);
  const joined = await post(
    `/api/communities/${slug}/membership`,
    { join: true, agree: true, intro: "I dry mangoes in Kintampo." },
    member,
  );
  assert.deepEqual(await joined.json(), { joined: true, members: 2 });
  assert.equal(
    (
      await post(
        `/api/communities/no-such-place/membership`,
        { join: true },
        member,
      )
    ).status,
    404,
  );

  const ask = (body) => {
    const form = new FormData();
    form.set(
      "entry",
      JSON.stringify({
        kind: "problem",
        template: "farming_food",
        title: "Mango slices turn brown in my solar dryer",
        goal: "Dry mango slices that keep their colour.",
        approach: "Sliced thin and dried for two days.",
        ...body,
      }),
    );
    form.set("media", "[]");
    return post("/api/entries", form, member);
  };
  assert.equal((await ask({ public: false, communities: [] })).status, 400);
  assert.equal((await ask({ communities: ["not-real"] })).status, 400);
  const posted = await ask({ public: false, communities: [slug] });
  assert.equal(posted.status, 201);
  const { id } = await posted.json();

  const { document: people } = await documentAt(
    `/communities/${slug}?tab=members`,
  );
  assert.match(
    people.querySelector(".member-list").textContent,
    /I dry mangoes in Kintampo/,
  );
  assert.match(
    people.querySelector(".members-rules").textContent,
    /Say what you dried/,
  );
  const { document: community } = await documentAt(`/communities/${slug}`);
  assert.match(community.querySelector(".q-list").textContent, /Mango slices/);
  const { document: everyone } = await documentAt("/questions?show=all");
  assert.doesNotMatch(
    everyone.querySelector("main").textContent,
    /Mango slices/,
  );
  const { document: note } = await documentAt(`/entries/${id}`);
  assert.match(
    note.querySelector(".posted-to").textContent,
    /Shared only with\s*Solar dryers/,
  );
});

test("the discussion opens beside the note from a shareable address", async () => {
  const closed = await documentAt("/entries/two-pots-one-small-breakthrough");
  assert.ok(closed.document.querySelector(".disc-pane").hasAttribute("hidden"));
  assert.ok(
    closed.document.querySelector(
      'a.note-toggle[href="?discuss=1"][aria-expanded="false"]',
    ),
  );
  const open = await documentAt(
    "/entries/two-pots-one-small-breakthrough?discuss=1",
  );
  assert.ok(!open.document.querySelector(".disc-pane").hasAttribute("hidden"));
  assert.ok(open.document.querySelector(".is-discussing #why"));
  // The same toggle stays in place to close it again.
  assert.ok(open.document.querySelector('a.note-toggle[aria-expanded="true"]'));
});

test("questions, communities and the notebook are separate, linked places", async () => {
  const { response, document } = await documentAt("/questions");
  assert.equal(response.status, 200);
  assert.ok(document.querySelectorAll(".q-row").length >= 1);
  assert.ok(
    document.querySelector(
      'form.ask-bar[action="/new"] input[name="kind"][value="problem"]',
    ),
  );
  assert.ok(document.querySelector('.section-hero a[href="/notebook"]'));
  const library = await documentAt(
    "/communities/smallholder-growers?tab=library",
  );
  assert.match(
    library.document.querySelector(".library").textContent,
    /Clay pot cooler/,
  );
  const moved = await fetch(new URL("/you", base), { redirect: "manual" });
  assert.equal(moved.status, 307);
  assert.match(moved.headers.get("location"), /\/notebook\?tab=posts/);
  const nav = [...document.querySelectorAll(".topnav a")].map((a) =>
    a.getAttribute("href"),
  );
  for (const href of [
    "/discover",
    "/questions",
    "/communities",
    "/sessions",
    "/notebook",
    "/search",
  ])
    assert.ok(nav.includes(href), href);
  for (const href of nav) {
    const r = await fetch(new URL(href, base));
    assert.equal(r.status, 200, href);
  }
});
