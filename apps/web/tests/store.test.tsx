// @vitest-environment node
/**
 * The shared store against a real PostgreSQL database, created for this run
 * and dropped afterwards. Run `npm run db:start` locally first.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import sharp from "sharp";
import type { Account } from "@/lib/store.server";

const admin =
  process.env.UNSTUCK_TEST_DATABASE_URL ??
  "postgresql://unstuck@127.0.0.1:5433/unstuck";
const name = `unstuck_v_${Date.now().toString(36)}`;
let hashList = "";
const sample = (file: string) =>
  readFile(join(process.cwd(), "public", "samples", file));
// Hashes from the reference `pdqhash` implementation, read most-significant bit first.
const reference = {
  "garden-640.jpg":
    "d9e44b62adf095591b7839f304bd4adbc9fd49af94915b4b852d2696264226a5",
  "solder-640.jpg":
    "642f2df2364df3265b25819ae493bedc8a884c6627bc305fdb62c6fc648d90a9",
  "breadboard-640.jpg":
    "c1c70736e596c7c62592edc6e5966196efc3418662b39ce8324e9e799a6c1869",
};
async function adminQuery(sql: string) {
  const client = new pg.Client({ connectionString: admin });
  await client.connect();
  await client.query(sql);
  await client.end();
}
beforeAll(async () => {
  await adminQuery(`CREATE DATABASE ${name}`);
  const url = new URL(admin);
  url.pathname = `/${name}`;
  process.env.DATABASE_URL = url.toString();
  process.env.UNSTUCK_DATA_DIR = await mkdtemp(
    join(tmpdir(), "unstuck-files-"),
  );
  process.env.UNSTUCK_UPLOAD_REVIEW = "media";
  // Existing discussion fixtures deliberately reference labelled sample entries.
  process.env.UNSTUCK_SHOW_EXAMPLES = "true";
  hashList = join(process.env.UNSTUCK_DATA_DIR!, "hashes.txt");
  await writeFile(hashList, "# test list\n");
  process.env.UNSTUCK_HASH_LIST = hashList;
});
afterAll(async () => {
  const { query } = await import("@/lib/db.server");
  await query("SELECT 1").catch(() => undefined);
  const shared = globalThis as { __unstuckDb?: { pool: pg.Pool } };
  await shared.__unstuckDb?.pool.end();
  await adminQuery(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
});
const store = () => import("@/lib/store.server");

describe("accounts", () => {
  it("signs in with a token, recovers on a new device, and retires old recovery codes", async () => {
    const s = await store();
    const { account, token, recovery } = await s.insertAccount(
      "Ama",
      "Student",
    );
    expect((await s.accountByToken(token))?.name).toBe("Ama");
    expect(await s.accountByToken("not-a-token")).toBeUndefined();
    const elsewhere = await s.recover(
      recovery.toLowerCase().replace(/-/g, " "),
    );
    expect(elsewhere.account.id).toBe(account.id);
    expect((await s.accountByToken(elsewhere.token))?.id).toBe(account.id);
    const fresh = await s.rotateRecovery(account.id);
    await expect(s.recover(recovery)).rejects.toThrow(/doesn’t match/);
    expect((await s.recover(fresh)).account.id).toBe(account.id);
    await s.dropToken(token);
    expect(await s.accountByToken(token)).toBeUndefined();
  });
});

describe("uploads", () => {
  it("re-encodes images, removing metadata such as location", async () => {
    const s = await store();
    const { account } = await s.insertAccount("Kofi", "");
    const tagged = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#c33" },
    })
      .jpeg()
      .withExif({ IFD0: { Copyright: "secret-location-tag" } })
      .toBuffer();
    expect((await sharp(tagged).metadata()).exif).toBeDefined();
    const { file } = await s.saveFile(account.id, "photo.jpg", tagged);
    expect(file.status).toBe("approved");
    const { readFile } = await import("node:fs/promises");
    const stored = await readFile(s.filePath(file.id));
    expect((await sharp(stored).metadata()).exif).toBeUndefined();
    expect(stored.toString("latin1")).not.toContain("secret-location-tag");
  });
  it("refuses disguised files and active PDFs, and holds media for review", async () => {
    const s = await store();
    const { account } = await s.insertAccount("Esi", "");
    await expect(
      s.saveFile(account.id, "x.png", Buffer.from("<html>")),
    ).rejects.toThrow(/Only JPEG/);
    await expect(
      s.saveFile(
        account.id,
        "a.pdf",
        Buffer.from(
          "%PDF-1.4\n1 0 obj << /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>",
        ),
      ),
    ).rejects.toThrow(/scripts/);
    const { file } = await s.saveFile(
      account.id,
      "lab.pdf",
      Buffer.from("%PDF-1.4\n% plain document"),
    );
    expect(file.status).toBe("pending");
  });
});

describe("limits and moderation", () => {
  it("refuses a burst beyond the limit, atomically", async () => {
    const s = await store();
    const results = await Promise.allSettled(
      Array.from({ length: 25 }, () => s.rateLimit("report", "burst")),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(
      s.limits.report.max,
    );
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { status: 429 },
    });
  });
  it("hides content after three people report it, and only moderators can restore it with a reason", async () => {
    const s = await store();
    const { account: author } = await s.insertAccount("Author", "");
    const id = s.newId();
    await s.insertSession({
      id,
      kind: "critique",
      owner: author.id,
      created: new Date().toISOString(),
      title: "A reported session",
      field: "Software",
      specialty: "Coursework",
      status: "open",
      wentWrong: "x",
      ask: "y",
      pins: [],
      rounds: [{ n: 1, note: "", notes: [] }],
      opened: "2026-11-07",
    });
    const reporters = await Promise.all(
      ["R1", "R2", "R3"].map((n) => s.insertAccount(n, "")),
    );
    expect(
      (await s.fileReport("session", id, reporters[0].account.id, "Spam"))
        .hidden,
    ).toBe(false);
    await s.fileReport("session", id, reporters[0].account.id, "Spam again");
    expect(
      (await s.fileReport("session", id, reporters[1].account.id, "Spam"))
        .hidden,
    ).toBe(false);
    expect(
      (await s.fileReport("session", id, reporters[2].account.id, "Spam"))
        .hidden,
    ).toBe(true);
    expect((await s.storedSessions()).some((x) => x.id === id)).toBe(false);
    const { account: plain } = await s.insertAccount("Plain", "");
    await expect(
      s.moderate(
        { ...plain, moderator: false, suspended: false, created: "" },
        "restore",
        "session",
        id,
        "Not spam at all",
      ),
    ).rejects.toThrow(/Only moderators/);
    const { account: mod } = await s.insertAccount("Mod", "");
    await s.makeModerator(mod.id);
    const moderator = (await s.accountById(mod.id))!;
    await expect(
      s.moderate(moderator, "restore", "session", id, "ok"),
    ).rejects.toThrow(/10 characters/);
    await s.moderate(
      moderator,
      "restore",
      "session",
      id,
      "Reviewed: an honest question, not spam.",
    );
    expect((await s.storedSessions()).some((x) => x.id === id)).toBe(true);
    const queue = await s.moderationQueue();
    expect(queue.reports.some((r) => r.target_id === id)).toBe(false);
    expect(queue.actions[0]).toMatchObject({
      action: "restore",
      moderator: "Mod",
    });
  });
});

describe("known-abuse hash matching", () => {
  it("computes PDQ hashes identical to the reference implementation", async () => {
    const { imagePdq } = await import("@/lib/scan.server");
    const { hamming } = await import("@/lib/pdq");
    for (const [file, hex] of Object.entries(reference))
      expect(await imagePdq(await sample(file))).toBe(hex);
    expect(
      hamming(reference["garden-640.jpg"], reference["solder-640.jpg"]),
    ).toBeGreaterThan(90);
  });
  it("quarantines a matching upload, suspends the account and opens an incident", async () => {
    const s = await store();
    const { storage } = await import("@/lib/storage.server");
    await writeFile(hashList, `${reference["solder-640.jpg"]},test entry\n`);
    const { account } = await s.insertAccount("Uploader", "");
    await expect(
      s.saveFile(account.id, "joint.jpg", await sample("solder-640.jpg")),
    ).rejects.toThrow("This file can’t be shared.");
    expect((await s.accountById(account.id))?.suspended).toBe(true);
    const [incident] = await s.openIncidents();
    expect(incident).toMatchObject({
      matched: "test entry",
      account: "Uploader",
      reported_at: null,
    });
    const { query } = await import("@/lib/db.server");
    const [file] = await query<{ id: string; status: string }>(
      "SELECT id, status FROM web.files WHERE owner = $1",
      [account.id],
    );
    expect(file.status).toBe("blocked");
    await expect(storage().size("files", file.id)).rejects.toThrow();
    expect(await storage().size("quarantine", file.id)).toBeGreaterThan(0);
    const { account: mod } = await s.insertAccount("Incident mod", "");
    await s.makeModerator(mod.id);
    await s.recordIncidentReport(
      (await s.accountById(mod.id))!,
      incident.id,
      "CT-123456",
    );
    expect((await s.openIncidents())[0].report_reference).toBe("CT-123456");
  });
  it("catches earlier uploads when the list is updated", async () => {
    const s = await store();
    const { storage } = await import("@/lib/storage.server");
    const { account } = await s.insertAccount("Earlier", "");
    const { file } = await s.saveFile(
      account.id,
      "board.jpg",
      await sample("breadboard-640.jpg"),
    );
    expect(file.status).toBe("approved");
    await writeFile(
      hashList,
      `${reference["breadboard-640.jpg"]},added later\n`,
    );
    const { account: mod } = await s.insertAccount("Recheck mod", "");
    await s.makeModerator(mod.id);
    const result = await s.recheckUploads((await s.accountById(mod.id))!);
    expect(result.matched).toBe(1);
    expect((await s.fileById(file.id))?.status).toBe("blocked");
    await expect(storage().size("files", file.id)).rejects.toThrow();
    expect((await s.accountById(account.id))?.suspended).toBe(true);
    await writeFile(hashList, "# empty\n");
  });
});

describe("appeals", () => {
  it("lets an owner appeal once, and needs a different moderator to decide their own action", async () => {
    const s = await store();
    const { account: owner } = await s.insertAccount("Appellant", "");
    const id = s.newId();
    await s.insertSession({
      id,
      kind: "critique",
      owner: owner.id,
      created: new Date().toISOString(),
      title: "A session a moderator hid",
      field: "Software",
      specialty: "Coursework",
      status: "open",
      wentWrong: "x",
      ask: "y",
      pins: [],
      rounds: [{ n: 1, note: "", notes: [] }],
      opened: "2026-11-07",
    });
    const [first, second] = await Promise.all(
      ["First mod", "Second mod"].map((n) => s.insertAccount(n, "")),
    );
    await s.makeModerator(first.account.id);
    await s.makeModerator(second.account.id);
    const m1 = (await s.accountById(first.account.id))!;
    const m2 = (await s.accountById(second.account.id))!;
    await s.moderate(m1, "hide", "session", id, "Looks like spam to me.");
    const me = (await s.accountById(owner.id))!;
    const { items } = await s.standing(me);
    expect(items[0]).toMatchObject({
      type: "session",
      id,
      reason: "A moderator wrote: “Looks like spam to me.”",
    });
    await expect(s.fileAppeal(me, "session", id, "too short")).rejects.toThrow(
      /too short/,
    );
    await s.fileAppeal(
      me,
      "session",
      id,
      "This is a real question about my coursework, not spam.",
    );
    await expect(
      s.fileAppeal(
        me,
        "session",
        id,
        "Trying a second time to get a different answer.",
      ),
    ).rejects.toThrow(/once/);
    const [appeal] = await s.openAppeals();
    await expect(
      s.decideAppeal(m1, appeal.id, "overturn", "I made a mistake here."),
    ).rejects.toThrow(/different moderator/);
    await s.decideAppeal(
      m2,
      appeal.id,
      "overturn",
      "Reviewed: genuine coursework question.",
    );
    expect((await s.storedSessions()).some((x) => x.id === id)).toBe(true);
    expect((await s.standing(me)).appeals[0]).toMatchObject({
      status: "overturned",
    });
  });
  it("refuses appeals about other people’s content", async () => {
    const s = await store();
    const { account } = await s.insertAccount("Bystander", "");
    await expect(
      s.fileAppeal(
        (await s.accountById(account.id))!,
        "session",
        s.newId(),
        "This is not mine but I want to appeal it.",
      ),
    ).rejects.toThrow(/your own/);
  });
});

describe("object storage", () => {
  let server: Server;
  const objects = new Map<string, Buffer>();
  beforeAll(async () => {
    // A minimal S3-compatible endpoint: path-style PUT, ranged GET and DELETE.
    server = createServer((req, res) => {
      const key = decodeURIComponent(req.url!.split("?")[0]);
      if (req.method === "PUT") {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          objects.set(key, Buffer.concat(chunks));
          res.writeHead(200, { ETag: '"x"' }).end();
        });
      } else if (req.method === "GET") {
        const body = objects.get(key);
        if (!body)
          return res
            .writeHead(404, { "Content-Type": "application/xml" })
            .end("<Error><Code>NoSuchKey</Code></Error>");
        const range = /bytes=(\d+)-(\d+)/.exec(req.headers.range ?? "");
        if (range) {
          const [start, end] = [
            Number(range[1]),
            Math.min(Number(range[2]), body.length - 1),
          ];
          res
            .writeHead(206, {
              "Content-Range": `bytes ${start}-${end}/${body.length}`,
              "Content-Length": end - start + 1,
            })
            .end(body.subarray(start, end + 1));
        } else res.writeHead(200, { "Content-Length": body.length }).end(body);
      } else if (req.method === "DELETE") {
        objects.delete(key);
        res.writeHead(204).end();
      }
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
  });
  afterAll(() => {
    server.close();
    delete process.env.UNSTUCK_S3_BUCKET;
  });
  it("stores, reads ranges from, and deletes files in an S3-compatible bucket", async () => {
    Object.assign(process.env, {
      UNSTUCK_S3_BUCKET: "unstuck-test",
      UNSTUCK_S3_ENDPOINT: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      UNSTUCK_S3_FORCE_PATH_STYLE: "true",
      UNSTUCK_S3_REGION: "us-east-1",
      UNSTUCK_S3_ACCESS_KEY_ID: "test",
      UNSTUCK_S3_SECRET_ACCESS_KEY: "test",
    });
    const { storage } = await import("@/lib/storage.server");
    await storage().put(
      "files",
      "abc",
      Buffer.from("0123456789"),
      "text/plain",
    );
    expect(objects.get("/unstuck-test/files/abc")?.toString()).toBe(
      "0123456789",
    );
    const part = await storage().get("files", "abc", { start: 2, end: 5 });
    expect(await new Response(part.stream).text()).toBe("2345");
    expect(part.size).toBe(10);
    expect(await storage().size("files", "abc")).toBe(10);
    await storage().remove("files", "abc");
    expect(objects.has("/unstuck-test/files/abc")).toBe(false);
    delete process.env.UNSTUCK_S3_BUCKET;
  });
});

describe("discussion at scale", () => {
  const people = async (n: number, prefix: string) => {
    const s = await store();
    return Promise.all(
      Array.from({ length: n }, async (_, i): Promise<Account> => ({
        ...(await s.insertAccount(`${prefix} ${i}`, "Student")).account,
        moderator: false,
        suspended: false,
        created: new Date().toISOString(),
      })),
    );
  };
  it("pages through responses with a cursor, without repeats or gaps", async () => {
    const d = await import("@/lib/discussion.server");
    const [writer] = await people(1, "Pager");
    const entry = "the-cache-was-not-the-problem";
    for (let i = 0; i < 45; i++)
      await d.addComment(writer, entry, {
        kind: i % 5 === 0 ? "question" : "comment",
        body: `Response number ${i}`,
      });
    const seen = new Set<string>();
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await d.listComments(entry, {
        sort: "newest",
        cursor,
        limit: 20,
      });
      expect(page.count).toBe(45);
      page.items.forEach((c) => seen.add(c.id));
      cursor = page.next ?? undefined;
      pages++;
    } while (cursor);
    expect(pages).toBe(3);
    expect(seen.size).toBe(45);
    const questions = await d.listComments(entry, { view: "questions" });
    expect(questions.count).toBe(9);
    const found = await d.listComments(entry, { q: "number 17" });
    expect(found.items.some((c) => c.body === "Response number 17")).toBe(true);
  });
  it("ranks explanations by distinct people’s evidence, never by votes", async () => {
    const d = await import("@/lib/discussion.server");
    const { getEntry } = await import("@/lib/api");
    const entry = "a-chair-worth-fixing";
    const [author, ...others] = await people(8, "Witness");
    const id = await d.addExplanation(author, entry, {
      title: "The tenon shrank as the wood dried",
    });
    const state = async () =>
      (await d.discussionSummary((await getEntry(entry))!)).explanations.find(
        (e) => e.id === id,
      )!;
    expect((await state()).state).toBe("proposed");
    // One person repeating themselves counts once.
    for (let i = 0; i < 3; i++)
      await d.addComment(others[0], entry, {
        kind: "supports",
        body: "Same here, the joint was loose again.",
        explanationId: id,
      });
    expect((await state()).state).toBe("proposed");
    for (const person of others.slice(1, 3))
      await d.addComment(person, entry, {
        kind: "supports",
        body: "Measured the tenon; it was undersized.",
        explanationId: id,
      });
    expect(await state()).toMatchObject({ state: "supported", supports: 3 });
    for (const person of others.slice(3, 7))
      await d.addComment(person, entry, {
        kind: "disputes",
        body: "Mine was a dry fit and still failed.",
        explanationId: id,
      });
    expect(await state()).toMatchObject({ state: "disputed", disputes: 4 });
    await expect(
      d.addComment(author, entry, {
        kind: "supports",
        body: "Evidence for something else",
        explanationId: "sample-99",
      }),
    ).rejects.toThrow(/Choose the explanation/);
  });
  it("lets others mark a response helpful once, but not its author", async () => {
    const d = await import("@/lib/discussion.server");
    const [author, reader] = await people(2, "Helper");
    const id = await d.addComment(author, "what-the-rain-changed", {
      kind: "comment",
      body: "Check the drainage under each bed.",
    });
    await expect(d.toggleHelpful(author, id)).rejects.toThrow(/your own/);
    expect(await d.toggleHelpful(reader, id)).toEqual({
      helped: true,
      helpful: 1,
    });
    expect(await d.toggleHelpful(reader, id)).toEqual({
      helped: false,
      helpful: 0,
    });
  });
  it("tells a poster what changed since their last visit and lists their posts", async () => {
    const d = await import("@/lib/discussion.server");
    const { createEntry } = await import("@/lib/entries.server");
    const [owner, asker, tester] = await people(3, "Poster");
    const form = new FormData();
    form.set(
      "entry",
      JSON.stringify({
        kind: "experience",
        template: "farming_food",
        outcome: "worked",
        title: "Shade cloth over the nursery bed",
        goal: "Keep seedlings alive through the dry season.",
      }),
    );
    const entry = await createEntry(owner, form);
    expect((await d.ownerInsights(owner, entry)).firstVisit).toBe(true);
    const question = await d.addComment(asker, entry, {
      kind: "question",
      body: "Did you take the cloth off at night?",
    });
    await d.addComment(tester, entry, {
      kind: "didnt",
      body: "In the rains the bed stayed too wet.",
    });
    expect(await d.ownerInsights(owner, entry)).toMatchObject({
      firstVisit: false,
      responses: 2,
      questions: 1,
      tried: 1,
    });
    // Seen now, so nothing is new until someone else posts.
    expect((await d.ownerInsights(owner, entry)).responses).toBe(0);
    const attention = await d.myPosts(owner, { filter: "attention" });
    expect(attention.items).toHaveLength(1);
    expect(attention.items[0]).toMatchObject({ id: entry, unanswered: 1 });
    await d.addComment(owner, entry, {
      kind: "comment",
      body: "Yes, every evening.",
      parentId: question,
    });
    expect(
      (await d.myPosts(owner, { filter: "attention" })).items,
    ).toHaveLength(0);
    expect((await d.myPosts(owner, {})).items[0].responses).toBe(3);
  });
});

describe("replying to a reply", () => {
  it("threads a reply under the response, names who it answers, and tells them", async () => {
    const s = await store();
    const d = await import("@/lib/discussion.server");
    const make = async (name: string): Promise<Account> => ({
      ...(await s.insertAccount(name, "")).account,
      moderator: false,
      suspended: false,
      created: new Date().toISOString(),
    });
    const [kofi, esi, yaw] = await Promise.all(
      ["Kofi", "Esi", "Yaw"].map(make),
    );
    const entry = "maize-yellowing-after-first-rains";
    const top = await d.addComment(kofi, entry, {
      kind: "question",
      body: "Did the yellowing start after the heavy rain?",
    });
    const first = await d.addComment(esi, entry, {
      kind: "comment",
      body: "Mine did. Waterlogging starves roots of nitrogen.",
      parentId: top,
    });
    await d.addComment(yaw, entry, {
      kind: "comment",
      body: "How long was the water standing?",
      parentId: top,
      replyTo: first,
    });
    const replies = await d.listReplies(top);
    expect(replies.map((r) => [r.author, r.replyToName ?? null])).toEqual([
      ["Esi", null],
      ["Yaw", "Esi"],
    ]);
    // A reply can only answer something in the same thread.
    const other = await d.addComment(kofi, entry, {
      kind: "comment",
      body: "Another thread entirely.",
    });
    await expect(
      d.addComment(yaw, entry, {
        kind: "comment",
        body: "Wrong thread",
        parentId: top,
        replyTo: other,
      }),
    ).rejects.toThrow(/reply target/);
    const forEsi = await d.repliesToMe(esi);
    expect(forEsi).toHaveLength(1);
    expect(forEsi[0]).toMatchObject({ author: "Yaw", fresh: true });
    expect((await d.repliesToMe(esi))[0].fresh).toBe(false);
    expect((await d.repliesToMe(kofi)).map((r) => r.author)).toEqual(["Esi"]);
  });
});

describe("communities", () => {
  it("creates open communities, counts members and keeps community-only posts out of the public feed", async () => {
    const s = await store();
    const c = await import("@/lib/communities.server");
    const { createEntry, publishedEntries, communityEntries } =
      await import("@/lib/entries.server");
    const make = async (name: string): Promise<Account> => ({
      ...(await s.insertAccount(name, "")).account,
      moderator: false,
      suspended: false,
      created: new Date().toISOString(),
    });
    const founder = await make("Founder");
    const slug = await c.createCommunity(founder, {
      name: "Fish smokers of Elmina",
      about: "Smoking fish over wood, and what made it spoil.",
      topic: "Food & farming",
      rules: "Say which wood you use.\nNo selling.",
    });
    expect(slug).toBe("fish-smokers-of-elmina");
    await expect(
      c.createCommunity(founder, {
        name: "Smallholder growers",
        about: "Trying to take a sample's name.",
        topic: "Food & farming",
        rules: ["Be kind."],
      }),
    ).rejects.toThrow(/already exists/);
    const reader = await make("Reader");
    // Joining means agreeing to the rules; an introduction is optional.
    await expect(c.setMembership(reader, slug, true)).rejects.toThrow(
      /Agree to the community/,
    );
    expect(
      await c.setMembership(reader, slug, true, {
        agree: true,
        intro: "I smoke tilapia for the Saturday market.",
      }),
    ).toEqual({ joined: true, members: 2 });
    expect(await c.setMembership(reader, slug, true, { agree: true })).toEqual({
      joined: true,
      members: 2,
    });
    const members = await c.listMembers(slug);
    expect(members.items.map((m) => m.name)).toEqual(["Reader", "Founder"]);
    expect((await c.communityBySlug(slug))?.rules).toEqual([
      "Say which wood you use.",
      "No selling.",
    ]);
    const form = new FormData();
    form.set(
      "entry",
      JSON.stringify({
        kind: "problem",
        template: "farming_food",
        title: "Smoked fish goes mouldy within a week",
        goal: "Keep smoked fish for a month.",
        approach: "Smoked for a day over mangrove wood.",
        public: false,
        communities: [slug],
      }),
    );
    const id = await createEntry(reader, form);
    expect((await publishedEntries()).some((e) => e.id === id)).toBe(false);
    expect((await communityEntries(slug)).map((e) => e.id)).toEqual([id]);
    const stats = await c.communityStats([slug], reader);
    expect(stats[slug]).toMatchObject({
      members: 2,
      questions: 1,
      unanswered: 1,
      library: 0,
      joined: true,
    });
    expect((await c.myCommunities(reader)).map((x) => x.slug)).toContain(slug);
    await c.setMembership(reader, slug, false);
    expect((await c.communityStats([slug], reader))[slug].joined).toBe(false);
  });
});

/** The newer collaboration workflows exercise real SQL, not repository mocks. */
async function collaborationActor(
  name = `Person ${Math.random().toString(36).slice(2, 8)}`,
) {
  const s = await store();
  const { account } = await s.insertAccount(name, "");
  return (await s.accountById(account.id))!;
}
async function collaborationProblem(owner: Account) {
  const { createProblem } = await import("@/lib/problems.server");
  return createProblem(owner, {
    title: "How can this community reduce food waste?",
    summary: "A shared question for the collaboration regression tests.",
    category: "Community",
  });
}
async function collaborationProposal(
  owner: Account,
  extra: Record<string, unknown> = {},
) {
  const { proposeImprovement } = await import("@/lib/improvements.server");
  const problemId = await collaborationProblem(owner);
  return proposeImprovement(owner, {
    problemId,
    title: "Try an earlier collection time",
    change: "Move collection to the morning and record participation.",
    reasoning: "An earlier time may fit more participants’ schedules.",
    ...extra,
  });
}

describe("collaboration access boundaries", () => {
  it("keeps restricted contents private while exposing only a directory title", async () => {
    const w = await import("@/lib/workspaces.server");
    const owner = await collaborationActor(),
      outsider = await collaborationActor();
    const id = await w.createWorkspace(owner, {
      title: "Restricted research team",
      goal: "SECRET GOAL: unannounced experiment",
      strategy: "SECRET STRATEGY",
      visibility: "restricted",
    });
    await w.addItem(owner, id, {
      kind: "evidence",
      title: "Confidential measurements",
      body: "SECRET RESULTS",
    });
    expect(await w.getWorkspace(id)).toBeUndefined();
    expect(await w.getWorkspace(id, outsider)).toBeUndefined();
    const listing = (await w.listWorkspaces()).find((x) => x.id === id)!;
    expect(listing.title).toBe("Restricted research team");
    expect(JSON.stringify(listing)).not.toContain("SECRET");
    expect(listing.members).toHaveLength(0);
    expect((await w.workspacePreview(id))?.title).toBe(listing.title);
    await w.setMemberRole(owner, id, outsider.name, "viewer");
    expect((await w.getWorkspace(id, outsider))?.workspace.items[0].body).toBe(
      "SECRET RESULTS",
    );
    const privateId = await w.createWorkspace(owner, {
      title: "A private team",
      goal: "This must stay out of the directory",
    });
    expect((await w.listWorkspaces()).some((x) => x.id === privateId)).toBe(
      false,
    );
    expect(await w.workspacePreview(privateId)).toBeUndefined();
  });
  it("revokes a contributor’s write access after demotion to viewer", async () => {
    const w = await import("@/lib/workspaces.server");
    const owner = await collaborationActor(),
      contributor = await collaborationActor();
    const id = await w.createWorkspace(owner, {
      title: "A public team",
      goal: "Track useful improvements in the community",
      visibility: "public",
    });
    await w.joinWorkspace(contributor, id);
    const item = await w.addItem(contributor, id, {
      kind: "idea",
      title: "A useful proposal",
    });
    await w.moveItem(contributor, id, item, "review");
    await w.setMemberRole(owner, id, contributor.name, "viewer");
    await expect(
      w.moveItem(contributor, id, item, "ready"),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      w.addItem(contributor, id, { kind: "idea", title: "No longer allowed" }),
    ).rejects.toMatchObject({ status: 403 });
    expect((await w.getWorkspace(id))?.workspace.items[0].status).toBe(
      "review",
    );
  });
  it("rejects ambiguous invitations and inherited item kinds, and refuses external disguised links", async () => {
    const w = await import("@/lib/workspaces.server");
    const owner = await collaborationActor();
    await collaborationActor("A shared display name");
    await collaborationActor("A shared display name");
    const id = await w.createWorkspace(owner, {
      title: "A private team",
      goal: "A workspace with deliberately private material",
    });
    await expect(
      w.setMemberRole(owner, id, "A shared display name", "editor"),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      w.addItem(owner, id, { kind: "toString", title: "Invalid kind" }),
    ).rejects.toThrow("Choose what");
    await w.addItem(owner, id, {
      kind: "idea",
      title: "A link to test",
      href: "//external.example",
    });
    expect(
      (await w.getWorkspace(id, owner))?.workspace.items[0].link,
    ).toBeUndefined();
  });
  it("does not allow outsiders to discuss or resolve a private proposal draft", async () => {
    const i = await import("@/lib/improvements.server");
    const owner = await collaborationActor(),
      outsider = await collaborationActor();
    const id = await collaborationProposal(owner, { draft: true });
    await expect(
      i.addImprovementEvent(outsider, id, {
        kind: "comment",
        body: "Trying to write into a private draft",
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(await i.getImprovement(id, outsider.id)).toBeUndefined();
    const event = await i.addImprovementEvent(owner, id, {
      kind: "question",
      body: "A private question for later",
    });
    await expect(
      i.resolveImprovementEvent(outsider, id, event, true),
    ).rejects.toMatchObject({ status: 404 });
    expect((await i.getImprovement(id, owner.id))?.events).toHaveLength(2);
  });
});

describe("concurrent collaboration writes", () => {
  it("keeps every parallel test run and preserves a simultaneous results update", async () => {
    const t = await import("@/lib/tests.server");
    const owner = await collaborationActor();
    const id = await t.createTest(
      owner,
      {
        title: "Participation at an earlier time",
        plan: { objective: "Measure participation for each collection time" },
      },
      {},
    );
    await Promise.all([
      ...Array.from({ length: 8 }, (_, n) =>
        t.updateTest(owner, id, {
          action: "run",
          measurement: `Run ${n}: ${10 + n} participants`,
          date: "2026-11-08",
        }),
      ),
      t.updateTest(owner, id, {
        action: "results",
        summary: "The recorded runs are available for review",
        rows: [
          {
            measure: "Participation",
            observed: "Eight runs",
            criterion: "Complete the pilot",
            met: true,
          },
        ],
      }),
    ]);
    const result = await t.getTest(id);
    expect(result?.runs).toHaveLength(8);
    expect(new Set(result?.runs.map((r) => r.measurement)).size).toBe(8);
    expect(result?.results?.summary).toBe(
      "The recorded runs are available for review",
    );
  });
  it("serializes proposal transitions and merges independent detail revisions", async () => {
    const i = await import("@/lib/improvements.server");
    const owner = await collaborationActor();
    const id = await collaborationProposal(owner);
    const changes = await Promise.allSettled([
      i.setImprovementStatus(owner, id, {
        status: "ready",
        note: "Ready after review",
      }),
      i.setImprovementStatus(owner, id, {
        status: "ready",
        note: "A concurrent request",
      }),
    ]);
    expect(changes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await Promise.all([
      i.reviseImprovement(owner, id, { benefit: "A newly recorded benefit" }),
      i.reviseImprovement(owner, id, { risks: "A separately recorded risk" }),
    ]);
    const proposal = await i.getImprovement(id);
    expect(proposal?.events.filter((e) => e.kind === "status")).toHaveLength(1);
    expect(proposal?.benefit).toBe("A newly recorded benefit");
    expect(proposal?.risks).toBe("A separately recorded risk");
  });
  it("includes live proposal activity and does not confuse people who share a display name", async () => {
    const i = await import("@/lib/improvements.server");
    const { activityFor } = await import("@/lib/activity.server");
    const owner = await collaborationActor("Same name in activity"),
      other = await collaborationActor("Same name in activity");
    const id = await collaborationProposal(owner);
    await i.addImprovementEvent(other, id, {
      kind: "concern",
      body: "Will the revised time exclude shift workers?",
    });
    const proposal = (await i.allImprovements(300)).find((x) => x.id === id);
    expect(proposal?.events).toHaveLength(2);
    expect(
      (await activityFor(owner)).some(
        (x) => x.kind === "review" && x.group === proposal?.title,
      ),
    ).toBe(true);
  });
});

describe("durable detail lookup", () => {
  it("loads an older saved draft beyond the first directory page without exposing it to another person", async () => {
    const d = await import("@/lib/drafts.server");
    const owner = await collaborationActor(),
      other = await collaborationActor();
    const id = await d.saveDraft(owner, {
      data: { title: "The oldest draft" },
    });
    for (let n = 0; n < 52; n++)
      await d.saveDraft(owner, { data: { title: `A newer draft ${n}` } });
    expect((await d.getDraft(owner, id))?.title).toBe("The oldest draft");
    expect(await d.getDraft(other, id)).toBeUndefined();
  });
});

describe("reviewed publishing and identity", () => {
  it("uses distinct public handles for same-name people and expires sessions", async () => {
    const { query } = await import("@/lib/db.server");
    const p = await import("@/lib/profile.server");
    const w = await import("@/lib/workspaces.server");
    const owner = await collaborationActor(),
      first = await collaborationActor("Two people named Adwoa"),
      second = await collaborationActor("Two people named Adwoa");
    expect(first.publicId).not.toBe(first.id);
    expect(first.publicId).not.toBe(second.publicId);
    expect(await p.profileByName(first.name)).toBeUndefined();
    expect((await p.profileByName(`p_${first.publicId}`))?.id).toBe(first.id);
    const id = await w.createWorkspace(owner, {
      title: "Handle invitations",
      goal: "Invite exactly the person intended",
    });
    await w.setMemberRole(
      owner,
      id,
      `https://example.com/people/p_${first.publicId}?tab=contributions`,
      "viewer",
    );
    expect((await w.getWorkspace(id, first))?.role).toBe("viewer");
    expect(await w.getWorkspace(id, second)).toBeUndefined();
    const s = await store();
    const { token } = await s.insertAccount("An expiring browser", "");
    expect(await s.accountByToken(token)).toBeDefined();
    await query(
      "UPDATE web.tokens SET expires_at = now() - interval '1 second' WHERE token_hash = $1",
      [s.hashToken(token)],
    );
    expect(await s.accountByToken(token)).toBeUndefined();
  });
  it("bounds decoded image dimensions and ignores forged client dimensions", async () => {
    const s = await store();
    const { createEntry, publishedEntry } =
      await import("@/lib/entries.server");
    const owner = await collaborationActor();
    const bytes = await sharp({
      create: { width: 2400, height: 1200, channels: 3, background: "#4a6" },
    })
      .jpeg()
      .toBuffer();
    const form = new FormData();
    form.set(
      "entry",
      JSON.stringify({
        title: "A bounded photo upload",
        classification: "worked",
        trying: "Keep pictures efficient to render",
        happened: "The uploaded photo was resized before delivery",
      }),
    );
    form.set(
      "media",
      JSON.stringify([
        { alt: "A plain green sample", width: 999999, height: 1 },
      ]),
    );
    form.set(
      "file-0",
      new File([new Uint8Array(bytes)], "image.jpg", { type: "image/jpeg" }),
    );
    const id = await createEntry(owner, form);
    const entry = await publishedEntry(id);
    expect(entry?.cover).toMatchObject({ width: 1600, height: 800 });
    const fileId = entry!.cover!.src.split("/").at(-1)!;
    expect((await s.fileById(fileId))?.status).toBe("approved");
    expect(
      (await sharp(await readFile(s.filePath(fileId))).metadata()).width,
    ).toBe(1600);
  });
  it("removes earlier staged attachments if a later attachment rejects publication", async () => {
    const { createEntry } = await import("@/lib/entries.server");
    const { query } = await import("@/lib/db.server");
    const owner = await collaborationActor();
    const bytes = await sharp({
      create: { width: 4, height: 4, channels: 3, background: "#779" },
    })
      .png()
      .toBuffer();
    const form = new FormData();
    form.set(
      "entry",
      JSON.stringify({
        title: "An aborted publication",
        classification: "failed",
        trying: "Publish two attachments",
        happened: "One attachment could not be read",
      }),
    );
    form.set(
      "media",
      JSON.stringify([
        { alt: "An acceptable first image" },
        { alt: "An invalid second image" },
      ]),
    );
    form.set("file-0", new File([new Uint8Array(bytes)], "valid.png"));
    form.set("file-1", new File(["invalid bytes"], "invalid.png"));
    await expect(createEntry(owner, form)).rejects.toThrow(/Only JPEG/);
    expect(
      await query("SELECT id FROM web.files WHERE owner = $1", [owner.id]),
    ).toHaveLength(0);
    expect(
      await query("SELECT id FROM web.entries WHERE owner = $1", [owner.id]),
    ).toHaveLength(0);
  });
  it("preserves independent plan field edits and resolves old problems outside the directory window", async () => {
    const { query } = await import("@/lib/db.server");
    const i = await import("@/lib/improvements.server");
    const p = await import("@/lib/problems.server");
    const owner = await collaborationActor();
    const proposal = await collaborationProposal(owner);
    await Promise.all([
      i.reviseImprovement(owner, proposal, {
        plan: { objective: "Record the participation rate" },
      }),
      i.reviseImprovement(owner, proposal, {
        plan: { procedure: "Count participants every morning" },
      }),
    ]);
    expect((await i.getImprovement(proposal))?.plan).toMatchObject({
      objective: "Record the participation rate",
      procedure: "Count participants every morning",
    });
    const oldest = await collaborationProblem(owner);
    await query(
      "UPDATE web.problems SET created = now() - interval '2 days' WHERE id = $1",
      [oldest],
    );
    const s = await store();
    const ids = Array.from({ length: 302 }, () => s.newId());
    await query(
      "INSERT INTO web.problems (id, owner, data) SELECT id, $2::uuid, $3::jsonb FROM unnest($1::uuid[]) id",
      [
        ids,
        owner.id,
        JSON.stringify({
          title: "A newer public problem",
          summary: "Used only for directory pagination regression",
          category: "General",
          needs: [],
          constraints: [],
          known: [],
          unknowns: [],
        }),
      ],
    );
    expect((await p.listProblems()).some((x) => x.id === oldest)).toBe(false);
    expect((await p.problemWork(oldest))?.problem.id).toBe(oldest);
  });
  it("follows public people, categories and workspace updates without revealing restricted items", async () => {
    const { query } = await import("@/lib/db.server");
    const { setFollow } = await import("@/lib/follows.server");
    const { activityFor } = await import("@/lib/activity.server");
    const { createEntry } = await import("@/lib/entries.server");
    const w = await import("@/lib/workspaces.server");
    const owner = await collaborationActor(),
      reader = await collaborationActor();
    const publicId = await w.createWorkspace(owner, {
      title: "Public activity team",
      goal: "Share progress with the public",
      visibility: "public",
    });
    const restrictedId = await w.createWorkspace(owner, {
      title: "Restricted activity team",
      goal: "Keep the work inside this team",
      visibility: "restricted",
    });
    for (const [type, id] of [
      ["person", owner.publicId!],
      ["category", "software"],
      ["workspace", publicId],
      ["workspace", restrictedId],
    ])
      await setFollow(reader, type, id, true);
    await query(
      "UPDATE web.follows SET created = now() - interval '1 day' WHERE account = $1",
      [reader.id],
    );
    const form = new FormData();
    form.set(
      "entry",
      JSON.stringify({
        title: "An attempt worth following",
        classification: "worked",
        trying: "Record progress for our followers",
        happened: "A new published experience is available",
      }),
    );
    const entry = await createEntry(owner, form);
    await w.addItem(owner, publicId, {
      kind: "idea",
      title: "An idea for everyone",
    });
    await w.addItem(owner, restrictedId, {
      kind: "idea",
      title: "SECRET restricted idea",
    });
    const activity = await activityFor(reader);
    expect(activity.some((x) => x.href === `/entries/${entry}`)).toBe(true);
    expect(activity.some((x) => x.href === `/workspaces/${publicId}`)).toBe(
      true,
    );
    expect(JSON.stringify(activity)).not.toContain("SECRET");
  });
});

it("keeps unfinished uploads out of delivery and moderator approval", async () => {
  const s = await store();
  const owner = await collaborationActor();
  const moderator = { ...(await collaborationActor()), moderator: true };
  const bytes = await sharp({
    create: { width: 8, height: 8, channels: 3, background: "#962" },
  })
    .jpeg()
    .toBuffer();
  const saved = await s.saveFile(owner.id, "staged.jpg", bytes, {
    staged: true,
  });
  expect(await s.fileById(saved.file.id)).toBeUndefined();
  expect(
    (await s.moderationQueue()).files.some((f) => f.id === saved.file.id),
  ).toBe(false);
  await expect(
    s.moderate(
      moderator,
      "approve-file",
      "file",
      saved.file.id,
      "Trying to approve an unfinished upload",
    ),
  ).rejects.toMatchObject({ status: 404 });
  await s.discardStagedFiles(owner.id, [saved.file.id]);
});

it("does not mix illustrative records, sessions or communities into live mode", async () => {
  process.env.UNSTUCK_SHOW_EXAMPLES = "false";
  try {
    const { getNotebook, getEntry } = await import("@/lib/api");
    const c = await import("@/lib/communities.server");
    const { loadSession } = await import("@/lib/shared.server");
    expect((await getNotebook()).entries.some((e) => e.example)).toBe(false);
    expect(await getEntry("two-pots-one-small-breakthrough")).toBeUndefined();
    expect(await loadSession("first-print-spaghetti")).toBeUndefined();
    expect((await c.listCommunities()).some((e) => e.sample)).toBe(false);
    expect((await c.searchCommunities({})).items.some((e) => e.sample)).toBe(
      false,
    );
    expect(await c.communityBySlug("smallholder-growers")).toBeUndefined();
  } finally {
    process.env.UNSTUCK_SHOW_EXAMPLES = "true";
  }
});
