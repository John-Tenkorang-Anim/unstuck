import "server-only";
import { getEntry } from "./api";
import { hasDatabase, query, showExamples, transaction } from "./db.server";
import {
  audiences,
  helpKinds,
  sampleHelp,
  type Audience,
  type HelpKind,
  type HelpOffer,
  type HelpRequest,
  type HelpStatus,
  type OfferStatus,
  type RouteReason,
  routeReason,
} from "./help";
import { getProblem } from "./problems.server";
import { clean, newId, StoreError, type Account } from "./store.server";
import { categoryName, categorySlug } from "./taxonomy";

const uuid = (s: string) =>
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(s);
const text = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
/** Routing stops here, so a busy category can’t turn one request into spam. */
const ROUTE_LIMIT = 60;

/**
 * Ask for help. The request keeps its link to a problem or attempt, and is
 * routed to people who follow that problem, who documented something similar,
 * or who follow its category. Each person is told why it reached them.
 */
export async function createHelp(
  account: Account,
  input: Record<string, unknown>,
) {
  const kind = helpKinds.find((k) => k.key === input.kind)?.key;
  if (!kind) throw new StoreError("Choose what kind of help you need.");
  const audience = (audiences.find((a) => a.key === input.audience)?.key ??
    "other") as Audience;
  const title = clean.text(input.title, 8, 180, "Your request");
  const body = clean.text(input.body, 20, 4000, "The details");
  let problemId = text(input.problemId, 200) || null;
  const entryId = text(input.entryId, 200) || null;
  let category = categoryName(input.category);
  if (entryId) {
    const entry = await getEntry(entryId).catch(() => undefined);
    if (!entry || entry.hidden)
      throw new StoreError("That attempt doesn’t exist.", 404);
    problemId ??= entry.problem ?? null;
    category ||= entry.topic;
  }
  if (problemId) {
    const problem = await getProblem(problemId);
    if (!problem) throw new StoreError("That problem doesn’t exist.", 404);
    category ||= problem.category;
  }
  // Hints-only matters for graded work; it can’t be claimed for other kinds.
  const graded =
    input.graded === true &&
    (kind === "hints" || kind === "explain" || kind === "review");
  const id = newId();
  const slug = categorySlug(category);
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO web.help_requests (id, owner, problem_id, entry_id, kind, audience, title, body, graded, category)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        account.id,
        problemId,
        entryId,
        kind,
        audience,
        title,
        body,
        graded,
        category,
      ],
    );
    const route = (reason: RouteReason, sql: string, values: unknown[]) =>
      client.query(
        `INSERT INTO web.help_routes (request, account, reason)
         SELECT $1, a, '${reason}' FROM (${sql}) AS candidates(a)
         WHERE a <> $2 AND (SELECT count(*) FROM web.help_routes WHERE request = $1) < ${ROUTE_LIMIT}
         LIMIT ${ROUTE_LIMIT}
         ON CONFLICT DO NOTHING`,
        [id, account.id, ...values],
      );
    // The closest connection wins: following the problem, then similar work, then the category.
    if (problemId)
      await route(
        "problem",
        "SELECT account FROM web.follows WHERE target_type = 'problem' AND target_id = $3",
        [problemId],
      );
    await route(
      "similar",
      `SELECT DISTINCT owner FROM web.entries WHERE NOT hidden AND (($3::text IS NOT NULL AND data->>'problem' = $3) OR lower(data->>'topic') = lower($4))`,
      [problemId, category || "\u0000"],
    );
    if (slug)
      await route(
        "category",
        "SELECT account FROM web.follows WHERE target_type = 'category' AND target_id = $3",
        [slug],
      );
  });
  return id;
}

type Row = {
  id: string;
  owner: string;
  problem_id: string | null;
  entry_id: string | null;
  kind: HelpKind;
  audience: Audience;
  title: string;
  body: string;
  graded: boolean;
  category: string;
  status: HelpStatus;
  created: Date;
  updated: Date;
  author: string;
  handle: string | null;
  routed: number;
  reason: RouteReason | null;
};
const select = `SELECT r.*, a.name AS author, a.public_id::text AS handle,
  (SELECT count(*)::int FROM web.help_routes x WHERE x.request = r.id) AS routed,
  (SELECT x.reason FROM web.help_routes x WHERE x.request = r.id AND x.account = $1) AS reason
  FROM web.help_requests r JOIN web.accounts a ON a.id = r.owner`;
const fromRow = (r: Row, offers: HelpOffer[] = []): HelpRequest => ({
  id: r.id,
  kind: r.kind,
  audience: r.audience,
  title: r.title,
  body: r.body,
  graded: r.graded,
  status: r.status,
  problemId: r.problem_id ?? undefined,
  entryId: r.entry_id ?? undefined,
  category: r.category,
  author: r.author,
  authorHandle: r.handle ? `p_${r.handle}` : undefined,
  owner: r.owner,
  offers,
  routed: r.routed,
  reason: r.reason ? routeReason[r.reason] : undefined,
  created: r.created.toISOString(),
  updated: r.updated.toISOString(),
});
async function offersFor(ids: string[]) {
  const map = new Map<string, HelpOffer[]>();
  if (!ids.length) return map;
  const rows = await query<{
    id: string;
    request: string;
    owner: string;
    body: string;
    status: OfferStatus;
    helped: boolean;
    created: Date;
    author: string;
    handle: string | null;
  }>(
    `SELECT o.*, a.name AS author, a.public_id::text AS handle FROM web.help_offers o
     JOIN web.accounts a ON a.id = o.owner WHERE o.request = ANY($1) AND NOT o.hidden ORDER BY o.created`,
    [ids],
  );
  for (const o of rows)
    map.set(o.request, [
      ...(map.get(o.request) ?? []),
      {
        id: o.id,
        author: o.author,
        authorHandle: o.handle ? `p_${o.handle}` : undefined,
        owner: o.owner,
        body: o.body,
        status: o.status,
        helped: o.helped,
        created: o.created.toISOString(),
      },
    ]);
  return map;
}

export interface HelpFilter {
  status?: HelpStatus | "";
  kind?: string;
  audience?: string;
  problemId?: string;
  /** Only requests routed to the viewer. */
  forMe?: boolean;
  mine?: boolean;
  size?: number;
}
/** Requests for help, open ones first, newest within each. */
export async function listHelp(
  filter: HelpFilter = {},
  viewer?: Pick<Account, "id">,
) {
  const size = Math.min(50, filter.size ?? 30);
  const samples = (showExamples() ? sampleHelp : []).filter(
    (h) =>
      !filter.forMe &&
      !filter.mine &&
      (!filter.status || h.status === filter.status) &&
      (!filter.kind || h.kind === filter.kind) &&
      (!filter.audience || h.audience === filter.audience) &&
      (!filter.problemId || h.problemId === filter.problemId),
  );
  if (!hasDatabase()) return samples.slice(0, size);
  const values: unknown[] = [viewer?.id ?? null];
  const where = ["NOT r.hidden"];
  const add = (sql: string, v: unknown) => {
    values.push(v);
    where.push(sql.replace("?", `$${values.length}`));
  };
  if (filter.status) add("r.status = ?", filter.status);
  if (filter.kind) add("r.kind = ?", filter.kind);
  if (filter.audience) add("r.audience = ?", filter.audience);
  if (filter.problemId) add("r.problem_id = ?", filter.problemId);
  if (filter.forMe)
    where.push(
      "EXISTS (SELECT 1 FROM web.help_routes x WHERE x.request = r.id AND x.account = $1)",
    );
  if (filter.mine) where.push("r.owner = $1");
  const rows = await query<Row>(
    `${select} WHERE ${where.join(" AND ")} ORDER BY (r.status <> 'open'), r.created DESC LIMIT ${size}`,
    values,
  );
  const offers = await offersFor(rows.map((r) => r.id));
  return [...rows.map((r) => fromRow(r, offers.get(r.id))), ...samples].slice(
    0,
    size,
  );
}

export async function getHelp(id: string, viewer?: Pick<Account, "id">) {
  const sample = (showExamples() ? sampleHelp : []).find((h) => h.id === id);
  if (sample) return sample;
  if (!hasDatabase() || !uuid(id)) return undefined;
  const [row] = await query<Row>(`${select} WHERE r.id = $2 AND NOT r.hidden`, [
    viewer?.id ?? null,
    id,
  ]);
  if (!row) return undefined;
  return fromRow(row, (await offersFor([id])).get(id));
}

/** Offer to help. One offer per person; the asker is never routed to themselves. */
export async function offerHelp(
  account: Account,
  id: string,
  input: Record<string, unknown>,
) {
  if (!uuid(id)) throw new StoreError("That request doesn’t exist.", 404);
  const body = clean.text(input.body, 10, 3000, "Your offer");
  return transaction(async (client) => {
    const {
      rows: [req],
    } = await client.query<{ owner: string; status: HelpStatus }>(
      "SELECT owner, status FROM web.help_requests WHERE id = $1 AND NOT hidden FOR UPDATE",
      [id],
    );
    if (!req) throw new StoreError("That request doesn’t exist.", 404);
    if (req.owner === account.id)
      throw new StoreError("You can’t offer help on your own request.");
    if (req.status !== "open")
      throw new StoreError("This request isn’t looking for help any more.");
    const offerId = newId();
    const { rowCount } = await client.query(
      "INSERT INTO web.help_offers (id, request, owner, body) VALUES ($1,$2,$3,$4) ON CONFLICT (request, owner) DO NOTHING",
      [offerId, id, account.id, body],
    );
    if (!rowCount)
      throw new StoreError("You’ve already offered to help here.", 409);
    await client.query(
      "UPDATE web.help_requests SET updated = now() WHERE id = $1",
      [id],
    );
    return offerId;
  });
}

/**
 * The asker accepts or declines an offer, says it helped (which credits the
 * helper and marks the request helped), closes or reopens the request.
 */
export async function respondToHelp(
  account: Account,
  id: string,
  input: Record<string, unknown>,
) {
  if (!uuid(id)) throw new StoreError("That request doesn’t exist.", 404);
  const action = String(input.action);
  await transaction(async (client) => {
    const {
      rows: [req],
    } = await client.query<{ owner: string; status: HelpStatus }>(
      "SELECT owner, status FROM web.help_requests WHERE id = $1 AND NOT hidden FOR UPDATE",
      [id],
    );
    if (!req) throw new StoreError("That request doesn’t exist.", 404);
    if (req.owner !== account.id && !account.moderator)
      throw new StoreError("Only the person who asked can do that.", 403);
    if (action === "close" || action === "reopen") {
      await client.query(
        "UPDATE web.help_requests SET status = $2, updated = now() WHERE id = $1",
        [id, action === "close" ? "closed" : "open"],
      );
      return;
    }
    const offer = String(input.offer ?? "");
    if (!uuid(offer)) throw new StoreError("Choose an offer.");
    const next =
      action === "accept"
        ? "status = 'accepted'"
        : action === "decline"
          ? "status = 'declined', helped = false"
          : action === "helped"
            ? "status = 'accepted', helped = true"
            : "";
    if (!next) throw new StoreError("That isn’t something you can do here.");
    const { rowCount } = await client.query(
      `UPDATE web.help_offers SET ${next}, updated = now() WHERE id = $1 AND request = $2 AND NOT hidden`,
      [offer, id],
    );
    if (!rowCount) throw new StoreError("That offer doesn’t exist.", 404);
    if (action === "helped")
      await client.query(
        "UPDATE web.help_requests SET status = 'helped', updated = now() WHERE id = $1",
        [id],
      );
  });
}

/** For Activity: offers on your requests, requests routed to you, and your offers’ outcomes. */
export async function helpActivity(account: Pick<Account, "id">) {
  if (!hasDatabase()) return { offers: [], routed: [], outcomes: [] };
  const [offers, routed, outcomes] = await Promise.all([
    query<{
      request: string;
      title: string;
      author: string;
      body: string;
      created: Date;
    }>(
      `SELECT r.id AS request, r.title, a.name AS author, o.body, o.created FROM web.help_offers o
       JOIN web.help_requests r ON r.id = o.request JOIN web.accounts a ON a.id = o.owner
       WHERE r.owner = $1 AND NOT o.hidden AND NOT r.hidden AND o.created > now() - interval '45 days'
       ORDER BY o.created DESC LIMIT 30`,
      [account.id],
    ),
    query<{
      request: string;
      title: string;
      kind: HelpKind;
      reason: RouteReason;
      created: Date;
    }>(
      `SELECT r.id AS request, r.title, r.kind, x.reason, x.created FROM web.help_routes x
       JOIN web.help_requests r ON r.id = x.request
       WHERE x.account = $1 AND r.status = 'open' AND NOT r.hidden AND x.created > now() - interval '30 days'
         AND NOT EXISTS (SELECT 1 FROM web.help_offers o WHERE o.request = r.id AND o.owner = $1)
       ORDER BY x.created DESC LIMIT 30`,
      [account.id],
    ),
    query<{
      request: string;
      title: string;
      status: OfferStatus;
      helped: boolean;
      updated: Date;
    }>(
      `SELECT r.id AS request, r.title, o.status, o.helped, o.updated FROM web.help_offers o
       JOIN web.help_requests r ON r.id = o.request
       WHERE o.owner = $1 AND o.status = 'accepted' AND NOT r.hidden AND o.updated > now() - interval '45 days'
       ORDER BY o.updated DESC LIMIT 30`,
      [account.id],
    ),
  ]);
  return { offers, routed, outcomes };
}

/** How many people someone helped, by name, for profiles. Samples count too. */
export async function helpedCount(name: string) {
  const sample = (showExamples() ? sampleHelp : []).filter((h) =>
    h.offers.some((o) => o.author === name && o.helped),
  ).length;
  if (!hasDatabase()) return sample;
  const [row] = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM web.help_offers o JOIN web.accounts a ON a.id = o.owner
     WHERE a.name = $1 AND o.helped AND NOT o.hidden`,
    [name],
  );
  return sample + (row?.n ?? 0);
}
