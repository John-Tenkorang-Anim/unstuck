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
