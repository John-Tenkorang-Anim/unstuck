import "server-only";
import { getEntry } from "./api";
import { hasDatabase, query, transaction } from "./db.server";
import { clean, newId, StoreError, type Account } from "./store.server";
import type { Entry } from "./types";

export type CommentKind =
  "comment" | "question" | "supports" | "disputes" | "worked" | "didnt";
export const commentKinds: CommentKind[] = [
  "comment",
  "question",
  "supports",
  "disputes",
  "worked",
  "didnt",
];
export type ExplanationState =
  "proposed" | "supported" | "verified" | "disputed";
export interface Explanation {
  id: string;
  title: string;
  detail: string;
  state: ExplanationState;
  supports: number;
  disputes: number;
  people: number;
  sample: boolean;
}
export interface Comment {
  id: string;
  kind: CommentKind;
  body: string;
  author: string;
  role: string;
  by: string;
  explanationId: string | null;
  explanationTitle?: string;
  helpful: number;
  helpedByMe: boolean;
  replies: number;
  created: string;
}
export interface Summary {
  total: number;
  people: number;
  questions: number;
  unanswered: number;
  worked: number;
  didnt: number;
  explanations: Explanation[];
}
export type View = "all" | "questions" | "tried" | `explanation:${string}`;
export type Sort = "helpful" | "newest" | "oldest";

/** Sample explanations have stable ids derived from their position. */
const sampleId = (entryId: string, index: number) => `sample-${index + 1}`;
const empty: Summary = {
  total: 0,
  people: 0,
  questions: 0,
  unanswered: 0,
  worked: 0,
  didnt: 0,
  explanations: [],
};

/**
 * An explanation's standing comes from distinct people's evidence, never from
 * votes: three or more supporters with at most half as many disputing makes it
 * supported; three or more disputing who outnumber supporters makes it disputed.
 */
function stateFor(
  supports: number,
  disputes: number,
  seeded?: string,
): ExplanationState {
  if (seeded === "verified") return "verified";
  if (disputes >= 3 && disputes > supports) return "disputed";
  if (supports >= 3 && supports >= disputes * 2) return "supported";
  return seeded === "supported" ? "supported" : "proposed";
}

export async function discussionSummary(entry: Entry): Promise<Summary> {
  const seeded = (entry.evidence ?? []).map((e, i) => ({
    id: sampleId(entry.id, i),
    title: e.label,
    detail: e.detail,
    seededState: e.state,
    sample: true,
  }));
  if (!hasDatabase())
    return {
      ...empty,
      explanations: seeded.map((e) => ({
        ...e,
        state: stateFor(0, 0, e.seededState),
        supports: 0,
        disputes: 0,
        people: 0,
      })),
    };
  const [totals] = await query<{
    total: number;
    people: number;
    questions: number;
    unanswered: number;
    worked: number;
    didnt: number;
  }>(
    `SELECT count(*)::int AS total,
            count(DISTINCT owner)::int AS people,
            count(*) FILTER (WHERE kind = 'question')::int AS questions,
            count(*) FILTER (WHERE kind = 'question' AND NOT EXISTS (
              SELECT 1 FROM web.comments r WHERE r.parent_id = c.id AND NOT r.hidden))::int AS unanswered,
            count(*) FILTER (WHERE kind = 'worked')::int AS worked,
            count(*) FILTER (WHERE kind = 'didnt')::int AS didnt
     FROM web.comments c WHERE entry_id = $1 AND parent_id IS NULL AND NOT hidden`,
    [entry.id],
  );
  const stored = await query<{ id: string; title: string; detail: string }>(
    "SELECT id::text, title, detail FROM web.explanations WHERE entry_id = $1 AND NOT hidden ORDER BY created",
    [entry.id],
  );
  const evidence = await query<{
    explanation_id: string;
    supports: number;
    disputes: number;
    people: number;
  }>(
    `SELECT explanation_id,
            count(DISTINCT owner) FILTER (WHERE kind = 'supports')::int AS supports,
            count(DISTINCT owner) FILTER (WHERE kind = 'disputes')::int AS disputes,
            count(DISTINCT owner)::int AS people
     FROM web.comments WHERE entry_id = $1 AND explanation_id IS NOT NULL AND NOT hidden GROUP BY explanation_id`,
    [entry.id],
  );
  const counts = new Map(evidence.map((e) => [e.explanation_id, e]));
  const explanations: Explanation[] = [
    ...seeded,
    ...stored.map((e) => ({ ...e, seededState: undefined, sample: false })),
  ]
    .map((e) => {
      const c = counts.get(e.id) ?? { supports: 0, disputes: 0, people: 0 };
      return {
        id: e.id,
        title: e.title,
        detail: e.detail,
        sample: e.sample,
        supports: c.supports,
        disputes: c.disputes,
        people: c.people,
        state: stateFor(c.supports, c.disputes, e.seededState),
      };
    })
    .sort((a, b) => rank(b) - rank(a) || b.supports - a.supports);
  return { ...totals, explanations };
}
const rank = (e: Explanation) =>
  ({ verified: 3, supported: 2, proposed: 1, disputed: 0 })[e.state];

const cursorOf = (
  row: { helpful: number; stamp: string; id: string },
  sort: Sort,
) =>
  // The stamp is Postgres's own text form, which keeps microseconds. A
  // JavaScript Date would round to milliseconds and skip rows that share one.
  Buffer.from(
    JSON.stringify(
      sort === "helpful"
        ? [row.helpful, row.stamp, row.id]
        : [row.stamp, row.id],
    ),
  ).toString("base64url");
function readCursor(cursor: string | undefined, sort: Sort) {
  if (!cursor) return undefined;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString());
    if (!Array.isArray(value) || value.length !== (sort === "helpful" ? 3 : 2))
      return undefined;
    return value as (string | number)[];
  } catch {
    return undefined;
  }
}

/**
 * One page of top-level responses. Keyset pagination keeps every page as
 * cheap as the first, however long the discussion grows.
 */
export async function listComments(
  entryId: string,
  options: {
    view?: View;
    sort?: Sort;
    q?: string;
    cursor?: string;
    limit?: number;
    viewer?: string;
  },
) {
  if (!hasDatabase())
    return { items: [] as Comment[], next: null as string | null, count: 0 };
  const view = options.view ?? "all";
  const sort = options.sort ?? "helpful";
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const params: unknown[] = [entryId];
  const where = ["c.entry_id = $1", "NOT c.hidden"];
  if (view.startsWith("explanation:")) {
    params.push(view.slice("explanation:".length));
    where.push(`c.explanation_id = $${params.length}`);
  } else {
    where.push("c.parent_id IS NULL");
    if (view === "questions") where.push("c.kind = 'question'");
    if (view === "tried") where.push("c.kind IN ('worked', 'didnt')");
  }
  const q = options.q?.trim().slice(0, 200);
  if (q) {
    params.push(q);
    where.push(
      `to_tsvector('simple', c.body) @@ websearch_to_tsquery('simple', $${params.length})`,
    );
  }
  const countWhere = [...where];
  const countParams = [...params];
  const after = readCursor(options.cursor, sort);
  if (after) {
    params.push(...after);
    const n = params.length;
    where.push(
      sort === "helpful"
        ? `(c.helpful, c.created, c.id) < ($${n - 2}::int, $${n - 1}::timestamptz, $${n}::uuid)`
        : sort === "newest"
          ? `(c.created, c.id) < ($${n - 1}::timestamptz, $${n}::uuid)`
          : `(c.created, c.id) > ($${n - 1}::timestamptz, $${n}::uuid)`,
    );
  }
  const order =
    sort === "helpful"
      ? "c.helpful DESC, c.created DESC, c.id DESC"
      : sort === "newest"
        ? "c.created DESC, c.id DESC"
        : "c.created ASC, c.id ASC";
  params.push(options.viewer ?? null);
  const viewerParam = params.length;
  params.push(limit + 1);
  const rows = await query<{
    id: string;
    kind: CommentKind;
    body: string;
    author: string;
    role: string;
    owner: string;
    explanation_id: string | null;
    explanation_title: string | null;
    helpful: number;
    helped: boolean;
    replies: number;
    created: Date;
    stamp: string;
  }>(
    `SELECT c.id, c.kind, c.body, a.name AS author, a.role, c.owner, c.explanation_id, x.title AS explanation_title,
            c.helpful, c.created, c.created::text AS stamp,
            EXISTS (SELECT 1 FROM web.comment_helpful h WHERE h.comment_id = c.id AND h.account_id = $${viewerParam}::uuid) AS helped,
            (SELECT count(*)::int FROM web.comments r WHERE r.parent_id = c.id AND NOT r.hidden) AS replies
     FROM web.comments c
     JOIN web.accounts a ON a.id = c.owner
     LEFT JOIN web.explanations x ON x.id::text = c.explanation_id
     WHERE ${where.join(" AND ")}
     ORDER BY ${order}
     LIMIT $${params.length}`,
    params,
  );
  const [{ n }] = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM web.comments c WHERE ${countWhere.join(" AND ")}`,
    countParams,
  );
  const page = rows.slice(0, limit);
  return {
    items: page.map((r) => ({
      id: r.id,
      kind: r.kind,
      body: r.body,
      author: r.author,
      role: r.role,
      by: r.owner,
      explanationId: r.explanation_id,
      explanationTitle: r.explanation_title ?? undefined,
      helpful: r.helpful,
      helpedByMe: r.helped,
      replies: r.replies,
      created: r.created.toISOString(),
    })),
    next: rows.length > limit ? cursorOf(page.at(-1)!, sort) : null,
    count: n,
  };
}
export async function listReplies(parentId: string, viewer?: string) {
  const rows = await query<{
    id: string;
    kind: CommentKind;
    body: string;
    author: string;
    role: string;
    owner: string;
    helpful: number;
    helped: boolean;
    created: Date;
  }>(
    `SELECT c.id, c.kind, c.body, a.name AS author, a.role, c.owner, c.helpful, c.created,
            EXISTS (SELECT 1 FROM web.comment_helpful h WHERE h.comment_id = c.id AND h.account_id = $2::uuid) AS helped
     FROM web.comments c JOIN web.accounts a ON a.id = c.owner
     WHERE c.parent_id = $1 AND NOT c.hidden ORDER BY c.created LIMIT 200`,
    [parentId, viewer ?? null],
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    body: r.body,
    author: r.author,
    role: r.role,
    by: r.owner,
    explanationId: null,
    helpful: r.helpful,
    helpedByMe: r.helped,
    replies: 0,
    created: r.created.toISOString(),
  }));
}

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
async function entryOrFail(entryId: string) {
  const entry = await getEntry(entryId).catch(() => undefined);
  if (!entry || entry.hidden)
    throw new StoreError("That field note doesn’t exist.", 404);
  return entry;
}
export async function addComment(
  account: Account,
  entryId: string,
  input: {
    kind?: unknown;
    body?: unknown;
    explanationId?: unknown;
    parentId?: unknown;
  },
) {
  const entry = await entryOrFail(entryId);
  const kind = input.kind as CommentKind;
  if (!commentKinds.includes(kind))
    throw new StoreError("Choose what kind of response this is.");
  const body = clean.text(input.body, 2, 5000, "Your response");
  let explanationId: string | null = null;
  let parentId: string | null = null;
  if (typeof input.parentId === "string" && input.parentId) {
    if (!isUuid(input.parentId))
      throw new StoreError("That reply target doesn’t exist.", 404);
    const [parent] = await query(
      "SELECT 1 FROM web.comments WHERE id = $1 AND entry_id = $2 AND parent_id IS NULL",
      [input.parentId, entryId],
    );
    if (!parent) throw new StoreError("That reply target doesn’t exist.", 404);
    parentId = input.parentId;
  } else if (kind === "supports" || kind === "disputes") {
    const id = String(input.explanationId ?? "");
    const sampleIndex = /^sample-(\d+)$/.exec(id);
    const known = sampleIndex
      ? Number(sampleIndex[1]) >= 1 &&
        Number(sampleIndex[1]) <= (entry.evidence ?? []).length
      : isUuid(id) &&
        (
          await query(
            "SELECT 1 FROM web.explanations WHERE id = $1 AND entry_id = $2",
            [id, entryId],
          )
        ).length > 0;
    if (!known)
      throw new StoreError("Choose the explanation this evidence is about.");
    explanationId = id;
  }
  const id = newId();
  await query(
    "INSERT INTO web.comments (id, entry_id, explanation_id, parent_id, owner, kind, body) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [
      id,
      entryId,
      explanationId,
      parentId,
      account.id,
      parentId ? "comment" : kind,
      body,
    ],
  );
  return id;
}
export async function addExplanation(
  account: Account,
  entryId: string,
  input: { title?: unknown; detail?: unknown },
) {
  await entryOrFail(entryId);
  const id = newId();
  await query(
    "INSERT INTO web.explanations (id, entry_id, owner, title, detail) VALUES ($1,$2,$3,$4,$5)",
    [
      id,
      entryId,
      account.id,
      clean.text(input.title, 6, 200, "The explanation"),
      typeof input.detail === "string"
        ? input.detail.trim().slice(0, 2000)
        : "",
    ],
  );
  return id;
}
/** Mark a response helpful, or take it back. Helpful sorts responses; it never decides an explanation. */
export async function toggleHelpful(account: Account, commentId: string) {
  if (!isUuid(commentId))
    throw new StoreError("That response doesn’t exist.", 404);
  return transaction(async (client) => {
    const removed = await client.query(
      "DELETE FROM web.comment_helpful WHERE comment_id = $1 AND account_id = $2",
      [commentId, account.id],
    );
    if (removed.rowCount) {
      const { rows } = await client.query(
        "UPDATE web.comments SET helpful = helpful - 1 WHERE id = $1 RETURNING helpful",
        [commentId],
      );
      return { helped: false, helpful: rows[0]?.helpful ?? 0 };
    }
    const exists = await client.query(
      "SELECT 1 FROM web.comments WHERE id = $1 AND owner <> $2",
      [commentId, account.id],
    );
    if (!exists.rowCount)
      throw new StoreError("You can’t mark your own response helpful.", 400);
    await client.query(
      "INSERT INTO web.comment_helpful (comment_id, account_id) VALUES ($1,$2)",
      [commentId, account.id],
    );
    const { rows } = await client.query(
      "UPDATE web.comments SET helpful = helpful + 1 WHERE id = $1 RETURNING helpful",
      [commentId],
    );
    return { helped: true, helpful: rows[0].helpful };
  });
}

/** What changed on a person's own post since they last looked, then mark it seen. */
export async function ownerInsights(account: Account, entryId: string) {
  // The last visit stays inside Postgres so its microseconds aren't rounded away.
  const [fresh] = await query<{
    seen: Date | null;
    responses: number;
    questions: number;
    tried: number;
    evidence: number;
  }>(
    `WITH last AS (SELECT seen FROM web.last_seen WHERE account_id = $2 AND target = $3)
     SELECT (SELECT seen FROM last) AS seen,
            count(*)::int AS responses,
            count(*) FILTER (WHERE kind = 'question')::int AS questions,
            count(*) FILTER (WHERE kind IN ('worked', 'didnt'))::int AS tried,
            count(*) FILTER (WHERE kind IN ('supports', 'disputes'))::int AS evidence
     FROM web.comments WHERE entry_id = $1 AND NOT hidden AND owner <> $2
       AND created > coalesce((SELECT seen FROM last), '-infinity')`,
    [entryId, account.id, `entry:${entryId}`],
  );
  await query(
    `INSERT INTO web.last_seen (account_id, target, seen) VALUES ($1,$2,clock_timestamp())
     ON CONFLICT (account_id, target) DO UPDATE SET seen = clock_timestamp()`,
    [account.id, `entry:${entryId}`],
  );
  const { seen, ...counts } = fresh;
  return {
    firstVisit: !seen,
    since: (seen ?? new Date(0)).toISOString(),
    ...counts,
  };
}

/**
 * Everything a person has posted, with the numbers that tell them where to
 * look next. Paged, so people with hundreds of posts stay fast.
 */
export async function myPosts(
  account: Account,
  { page = 1, filter = "all" }: { page?: number; filter?: "all" | "attention" },
) {
  const size = 25;
  const rows = await query<{
    kind: "entry" | "session";
    id: string;
    title: string;
    created: Date;
    status: string | null;
    responses: number;
    fresh: number;
    unanswered: number;
    latest: Date | null;
    hidden: boolean;
  }>(
    `WITH posts AS (
       SELECT 'entry' AS kind, e.id::text AS id, e.data->>'title' AS title, e.created, NULL::text AS status, e.hidden
       FROM web.entries e WHERE e.owner = $1
       UNION ALL
       SELECT 'session', s.id::text, s.data->>'title', s.created, s.status, s.hidden FROM web.sessions s WHERE s.owner = $1
     )
     SELECT p.*,
       CASE WHEN p.kind = 'entry'
         THEN (SELECT count(*)::int FROM web.comments c WHERE c.entry_id = p.id AND NOT c.hidden)
         ELSE (SELECT count(*)::int FROM web.notes n WHERE n.session_id = p.id AND NOT n.hidden) END AS responses,
       CASE WHEN p.kind = 'entry'
         THEN (SELECT count(*)::int FROM web.comments c WHERE c.entry_id = p.id AND NOT c.hidden AND c.owner <> $1
               AND c.created > coalesce((SELECT seen FROM web.last_seen WHERE account_id = $1 AND target = 'entry:' || p.id), 'epoch'))
         ELSE (SELECT count(*)::int FROM web.notes n WHERE n.session_id = p.id AND NOT n.hidden AND n.owner <> $1
               AND n.created > coalesce((SELECT seen FROM web.last_seen WHERE account_id = $1 AND target = 'session:' || p.id), 'epoch')) END AS fresh,
       CASE WHEN p.kind = 'entry'
         THEN (SELECT count(*)::int FROM web.comments q WHERE q.entry_id = p.id AND q.kind = 'question' AND NOT q.hidden
               AND NOT EXISTS (SELECT 1 FROM web.comments r WHERE r.parent_id = q.id AND NOT r.hidden))
         ELSE 0 END AS unanswered,
       CASE WHEN p.kind = 'entry'
         THEN (SELECT max(created) FROM web.comments c WHERE c.entry_id = p.id)
         ELSE (SELECT max(created) FROM web.notes n WHERE n.session_id = p.id) END AS latest
     FROM posts p`,
    [account.id],
  );
  const sorted = rows
    .filter((r) => filter === "all" || r.fresh > 0 || r.unanswered > 0)
    .sort(
      (a, b) =>
        (b.latest ?? b.created).getTime() - (a.latest ?? a.created).getTime(),
    );
  return {
    total: sorted.length,
    pages: Math.max(1, Math.ceil(sorted.length / size)),
    items: sorted.slice((page - 1) * size, page * size),
  };
}
export async function markSessionSeen(account: Account, sessionId: string) {
  await query(
    `INSERT INTO web.last_seen (account_id, target, seen) VALUES ($1,$2,clock_timestamp())
     ON CONFLICT (account_id, target) DO UPDATE SET seen = clock_timestamp()`,
    [account.id, `session:${sessionId}`],
  );
}
