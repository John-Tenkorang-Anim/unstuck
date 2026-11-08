import "server-only";
import type { PoolClient } from "pg";
import { getEntry } from "./api";
import { hasDatabase, query, showExamples, transaction } from "./db.server";
import {
  discussionKinds,
  emptyPlan,
  nextStatuses,
  planFields,
  sampleImprovements,
  verdicts,
  type EventKind,
  type Improvement,
  type ImprovementEvent,
  type ImprovementStatus,
  type TestPlan,
  type Verdict,
} from "./improvements";
import { getProblem } from "./problems.server";
import { clean, newId, StoreError, type Account } from "./store.server";

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
const iso = (d: Date) => d.toISOString();
const text = (v: unknown, max = 3000) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

type Details = {
  title?: string;
  benefit?: string;
  risks?: string;
  questions?: string;
  plan?: Partial<TestPlan>;
};
type Row = {
  id: string;
  entry_id: string | null;
  problem_id: string | null;
  owner: string;
  change: string;
  reasoning: string;
  evidence: string;
  test_plan: string;
  results: string;
  status: ImprovementStatus;
  verdict: Verdict | null;
  details: Details;
  created: Date;
  updated: Date;
  author: string;
  role: string;
};
const columns = `i.*, a.name AS author, a.role`;
const fromRow = (
  r: Row,
  events: ImprovementEvent[] = [],
  collaborators: string[] = [],
): Improvement => ({
  id: r.id,
  entryId: r.entry_id ?? undefined,
  problemId: r.problem_id ?? undefined,
  title: r.details?.title || r.change.slice(0, 90),
  change: r.change,
  reasoning: r.reasoning,
  benefit: r.details?.benefit ?? "",
  risks: r.details?.risks ?? "",
  evidence: r.evidence,
  questions: r.details?.questions ?? "",
  plan: {
    ...emptyPlan(),
    procedure: r.test_plan,
    ...(r.details?.plan ?? {}),
  },
  results: r.results,
  status: r.status,
  verdict: r.verdict,
  author: r.author,
  authorRole: r.role,
  owner: r.owner,
  created: iso(r.created),
  updated: iso(r.updated),
  collaborators,
  events,
});
/** Drafts are visible only to the person writing them. */
const visible = (viewer?: string) =>
  `NOT i.hidden AND (i.status <> 'draft'${viewer ? ` OR i.owner = '${viewer}'` : ""})`;

/** Batch recent activity for selected proposals; directories never query once per row. */
async function withEvents(rows: Row[]) {
  if (!rows.length) return [];
  const events = await query<{
    id: string;
    improvement_id: string;
    kind: EventKind;
    body: string;
    actor: string;
    actor_id: string;
    role: string;
    from_status: ImprovementStatus | null;
    to_status: ImprovementStatus | null;
    resolved: boolean;
    created: Date;
  }>(
    `SELECT e.*, a.name AS actor, a.role, a.id AS actor_id FROM web.improvement_events e
      JOIN web.accounts a ON a.id = e.actor WHERE e.improvement_id = ANY($1) AND NOT e.hidden
      ORDER BY e.created DESC, e.id DESC LIMIT 2000`,
    [rows.map((r) => r.id)],
  );
  const grouped = new Map<string, typeof events>();
  for (const event of events) {
    const group = grouped.get(event.improvement_id) ?? [];
    group.push(event);
    grouped.set(event.improvement_id, group);
  }
  return rows.map((row) => {
    const own = (grouped.get(row.id) ?? []).reverse();
    return fromRow(
      row,
      own.map((e) => ({
        id: e.id,
        kind: e.kind,
        body: e.body,
        actor: e.actor,
        actorId: e.actor_id,
        role: e.role,
        from: e.from_status,
        to: e.to_status,
        resolved: e.resolved,
        created: iso(e.created),
      })),
      [
        ...new Set(
          own.filter((e) => e.actor_id !== row.owner).map((e) => e.actor),
        ),
      ],
    );
  });
}

/** Proposals that build on an attempt or a problem, samples first. */
export async function listImprovements(
  where: { entryId?: string; problemId?: string },
  viewer?: string,
) {
  const samples = (showExamples() ? sampleImprovements : []).filter(
    (i) =>
      (where.entryId && i.entryId === where.entryId) ||
      (where.problemId && i.problemId === where.problemId),
  );
  if (!hasDatabase()) return samples;
  if (viewer && !isUuid(viewer)) viewer = undefined;
  const rows = await query<Row>(
    `SELECT ${columns} FROM web.improvements i JOIN web.accounts a ON a.id = i.owner
     WHERE (i.entry_id = $1 OR i.problem_id = $2) AND ${visible(viewer)}
     ORDER BY i.updated DESC LIMIT 100`,
    [where.entryId ?? "", where.problemId ?? ""],
  );
  return [...samples, ...(await withEvents(rows))];
}
/** All proposals, for directories and discovery. */
export async function allImprovements(limit = 100) {
  if (!hasDatabase()) return showExamples() ? sampleImprovements : [];
  const rows = await query<Row>(
    `SELECT ${columns} FROM web.improvements i JOIN web.accounts a ON a.id = i.owner
     WHERE ${visible()} ORDER BY i.updated DESC LIMIT $1`,
    [limit],
  );
  return [
    ...(showExamples() ? sampleImprovements : []),
    ...(await withEvents(rows)),
  ];
}

/** Counts per attempt for feeds: proposals, and how many were supported. */
export async function improvementCounts(entryIds: string[]) {
  const counts = new Map<string, { total: number; validated: number }>();
  const add = (id: string, total: number, validated: number) => {
    const c = counts.get(id) ?? { total: 0, validated: 0 };
    c.total += total;
    c.validated += validated;
    counts.set(id, c);
  };
  for (const i of showExamples() ? sampleImprovements : [])
    if (i.entryId) add(i.entryId, 1, i.verdict === "supported" ? 1 : 0);
  if (!hasDatabase() || !entryIds.length) return counts;
  const rows = await query<{
    entry_id: string;
    total: number;
    validated: number;
  }>(
    `SELECT entry_id, count(*)::int AS total,
            count(*) FILTER (WHERE status = 'evaluated' AND verdict = 'supported')::int AS validated
     FROM web.improvements WHERE entry_id = ANY($1) AND NOT hidden AND status <> 'draft' GROUP BY entry_id`,
    [entryIds],
  );
  for (const r of rows) add(r.entry_id, r.total, r.validated);
  return counts;
}

/** One proposal with its full history: who proposed, questioned, tested. */
export async function getImprovement(id: string, viewer?: string) {
  const sample = (showExamples() ? sampleImprovements : []).find(
    (i) => i.id === id,
  );
  if (sample) return sample;
  if (!hasDatabase() || !isUuid(id)) return undefined;
  const [row] = await query<Row>(
    `SELECT ${columns} FROM web.improvements i JOIN web.accounts a ON a.id = i.owner
     WHERE i.id = $1 AND ${visible(viewer && isUuid(viewer) ? viewer : undefined)}`,
    [id],
  );
  if (!row) return undefined;
  const events = await query<{
    id: string;
    kind: EventKind;
    body: string;
    actor: string;
    role: string;
    actor_id: string;
    from_status: ImprovementStatus | null;
    to_status: ImprovementStatus | null;
    resolved: boolean;
    created: Date;
  }>(
    `SELECT e.id, e.kind, e.body, a.name AS actor, a.role, e.actor AS actor_id,
            e.from_status, e.to_status, e.resolved, e.created
     FROM web.improvement_events e JOIN web.accounts a ON a.id = e.actor
     WHERE e.improvement_id = $1 AND NOT e.hidden ORDER BY e.created LIMIT 500`,
    [id],
  );
  const collaborators = [
    ...new Set(
      events
        .filter((e) => e.actor_id !== row.owner && e.kind !== "created")
        .map((e) => e.actor),
    ),
  ];
  return fromRow(
    row,
    events.map((e) => ({
      id: e.id,
      kind: e.kind,
      body: e.body,
      actor: e.actor,
      actorId: e.actor_id,
      role: e.role,
      from: e.from_status,
      to: e.to_status,
      resolved: e.resolved,
      created: iso(e.created),
    })),
    collaborators,
  );
}

function readPlan(input: unknown): Partial<TestPlan> {
  const raw = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;
  return Object.fromEntries(
    planFields
      .filter(([key]) => Object.hasOwn(raw, key))
      .map(([key]) => [key, text(raw[key], 2000)]),
  );
}

/**
 * Propose a change to an attempt or a problem. Creating it in context keeps
 * the link: a proposal made from an attempt also belongs to that problem.
 */
export async function proposeImprovement(
  account: Account,
  input: Record<string, unknown>,
) {
  let entryId = text(input.entryId, 200) || null;
  let problemId = text(input.problemId, 200) || null;
  if (entryId) {
    const entry = await getEntry(entryId);
    if (!entry || entry.hidden)
      throw new StoreError("That attempt doesn’t exist.", 404);
    problemId ??= entry.problem ?? null;
  }
  if (problemId && !(await getProblem(problemId)))
    throw new StoreError("That problem doesn’t exist.", 404);
  if (!entryId && !problemId)
    throw new StoreError("Choose the attempt or problem this improves.");
  const title = clean.text(input.title, 6, 140, "The title");
  const change = clean.text(input.change, 10, 2000, "The proposed change");
  const reasoning = clean.text(input.reasoning, 10, 3000, "Your reasoning");
  const draft = input.draft === true;
  const details: Details = {
    title,
    benefit: text(input.benefit),
    risks: text(input.risks),
    questions: text(input.questions),
    plan: readPlan(input.plan),
  };
  const id = newId();
  const status: ImprovementStatus = draft ? "draft" : "discussion";
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO web.improvements (id, entry_id, problem_id, owner, change, reasoning, evidence, test_plan, status, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        entryId,
        problemId,
        account.id,
        change,
        reasoning,
        text(input.evidence),
        details.plan?.procedure ?? "",
        status,
        details,
      ],
    );
    await client.query(
      `INSERT INTO web.improvement_events (id, improvement_id, actor, kind, body, to_status)
       VALUES ($1,$2,$3,'created',$4,$5)`,
      [newId(), id, account.id, change, status],
    );
  });
  return id;
}

async function ownerRow(id: string, client: PoolClient) {
  if (!isUuid(id)) throw new StoreError("That proposal doesn’t exist.", 404);
  const {
    rows: [row],
  } = await client.query<{
    owner: string;
    entry_id: string | null;
    status: ImprovementStatus;
    details: Details;
  }>(
    "SELECT owner, entry_id, status, details FROM web.improvements WHERE id = $1 AND NOT hidden FOR UPDATE",
    [id],
  );
  if (!row) throw new StoreError("That proposal doesn’t exist.", 404);
  return row;
}
async function canSteer(
  account: Account,
  row: { owner: string; entry_id: string | null },
  client: PoolClient,
) {
  if (account.moderator || account.id === row.owner) return true;
  if (!row.entry_id || !isUuid(row.entry_id)) return false;
  const {
    rows: [entry],
  } = await client.query<{ owner: string }>(
    "SELECT owner FROM web.entries WHERE id = $1 AND NOT hidden",
    [row.entry_id],
  );
  return entry?.owner === account.id;
}

/**
 * Move a proposal through its lifecycle. The proposer, the attempt’s author
 * or a moderator can; everyone else contributes through the discussion. An
 * evaluation needs a verdict and a summary of what the tests found.
 */
export async function setImprovementStatus(
  account: Account,
  id: string,
  input: {
    status?: unknown;
    note?: unknown;
    results?: unknown;
    verdict?: unknown;
  },
) {
  return transaction(async (client) => {
    const row = await ownerRow(id, client);
    if (!(await canSteer(account, row, client)))
      throw new StoreError(
        "Only the proposer or the original author can change its status. Add your view to the discussion instead.",
        403,
      );
    const to = String(input.status) as ImprovementStatus;
    if (!nextStatuses[row.status]?.includes(to))
      throw new StoreError("That step isn’t available from here.");
    const results = text(input.results);
    const verdict =
      to === "evaluated" ? (String(input.verdict) as Verdict) : null;
    if (to === "evaluated" && !verdicts.includes(verdict as Verdict))
      throw new StoreError("Choose what the evaluation found.");
    if (to === "evaluated" && results.length < 10)
      throw new StoreError("Summarise what the tests found.");
    const note = text(input.note, 2000);
    await client.query(
      `UPDATE web.improvements SET status = $2, verdict = $3, updated = now()
       ${to === "evaluated" ? ", results = $4" : ""} WHERE id = $1`,
      to === "evaluated" ? [id, to, verdict, results] : [id, to, null],
    );
    await client.query(
      `INSERT INTO web.improvement_events (id, improvement_id, actor, kind, body, from_status, to_status)
       VALUES ($1,$2,$3,'status',$4,$5,$6)`,
      [
        newId(),
        id,
        account.id,
        to === "evaluated" ? results : note,
        row.status,
        to,
      ],
    );
    return to;
  });
}

/** Revise a proposal and record that change in its collaboration activity. */
export async function reviseImprovement(
  account: Account,
  id: string,
  input: Record<string, unknown>,
) {
  return transaction(async (client) => {
    const row = await ownerRow(id, client);
    if (!(await canSteer(account, row, client)))
      throw new StoreError(
        "Only the proposer can revise it. Suggest a change in the discussion.",
        403,
      );
    const details: Details = { ...row.details };
    for (const key of ["title", "benefit", "risks", "questions"] as const)
      if (typeof input[key] === "string") details[key] = text(input[key]);
    if (input.plan) details.plan = { ...details.plan, ...readPlan(input.plan) };
    const sets: string[] = ["details = $2", "updated = now()"];
    const values: unknown[] = [id, details];
    for (const [key, column] of [
      ["change", "change"],
      ["reasoning", "reasoning"],
      ["evidence", "evidence"],
    ] as const)
      if (typeof input[key] === "string") {
        values.push(text(input[key]));
        sets.push(`${column} = $${values.length}`);
      }
    const note = text(input.note, 500) || "Revised the proposal";
    await client.query(
      `UPDATE web.improvements SET ${sets.join(", ")} WHERE id = $1`,
      values,
    );
    await client.query(
      `INSERT INTO web.improvement_events (id, improvement_id, actor, kind, body) VALUES ($1,$2,$3,'revision',$4)`,
      [newId(), id, account.id, note],
    );
  });
}

/** Ask, raise a concern, add evidence or counterevidence, suggest, or comment. */
export async function addImprovementEvent(
  account: Account,
  id: string,
  input: { kind?: unknown; body?: unknown },
) {
  const kind = input.kind as EventKind;
  if (!discussionKinds.includes(kind))
    throw new StoreError("Choose what kind of contribution this is.");
  const body = clean.text(input.body, 2, 3000, "Your contribution");
  return transaction(async (client) => {
    const row = await ownerRow(id, client);
    if (row.status === "draft" && row.owner !== account.id)
      throw new StoreError("That proposal doesn’t exist.", 404);
    const eventId = newId();
    await client.query(
      `INSERT INTO web.improvement_events (id, improvement_id, actor, kind, body) VALUES ($1,$2,$3,$4,$5)`,
      [eventId, id, account.id, kind, body],
    );
    await client.query(
      "UPDATE web.improvements SET updated = now() WHERE id = $1",
      [id],
    );
    return eventId;
  });
}

/** Mark a question or concern answered, or reopen it. */
export async function resolveImprovementEvent(
  account: Account,
  id: string,
  eventId: string,
  resolved: boolean,
) {
  return transaction(async (client) => {
    const row = await ownerRow(id, client);
    if (row.status === "draft" && row.owner !== account.id)
      throw new StoreError("That proposal doesn’t exist.", 404);
    if (!isUuid(eventId)) throw new StoreError("That item doesn’t exist.", 404);
    const {
      rows: [event],
    } = await client.query<{ actor: string }>(
      "SELECT actor FROM web.improvement_events WHERE id = $1 AND improvement_id = $2 AND NOT hidden",
      [eventId, id],
    );
    if (!event) throw new StoreError("That item doesn’t exist.", 404);
    if (event.actor !== account.id && !(await canSteer(account, row, client)))
      throw new StoreError(
        "Only the person who asked or the proposer can mark it answered.",
        403,
      );
    await client.query(
      "UPDATE web.improvement_events SET resolved = $2 WHERE id = $1",
      [eventId, resolved],
    );
  });
}

/** Recent publication and collaboration activity; this is not an edit-version archive. */
export async function attemptHistory(
  entryId: string,
  published: string,
  by: string,
) {
  const items: { at: string; who: string; what: string; href?: string }[] = [
    { at: published, who: by, what: "Published the attempt" },
  ];
  for (const i of await listImprovements({ entryId }))
    for (const e of i.events)
      items.push({
        at: e.created,
        who: e.actor,
        what:
          e.kind === "created"
            ? `Proposed “${i.title}”`
            : e.kind === "status" && e.to
              ? `Moved “${i.title}” to ${e.to === "evaluated" && i.verdict ? `evaluated` : e.to}`
              : e.kind === "revision"
                ? `Revised “${i.title}”`
                : `Added a ${e.kind} to “${i.title}”`,
        href: `/improvements/${i.id}`,
      });
  if (hasDatabase()) {
    const rows = await query<{ at: Date; who: string; what: string }>(
      `SELECT x.created AS at, a.name AS who, 'Proposed an explanation: “' || left(x.title, 90) || '”' AS what
       FROM web.explanations x JOIN web.accounts a ON a.id = x.owner
       WHERE x.entry_id = $1 AND NOT x.hidden
       UNION ALL
       SELECT c.created, a.name, CASE c.kind WHEN 'supports' THEN 'Added supporting evidence'
                                    WHEN 'disputes' THEN 'Added contradicting evidence'
                                    WHEN 'worked' THEN 'Reported that it worked for them'
                                    ELSE 'Reported that it didn’t work for them' END
       FROM web.comments c JOIN web.accounts a ON a.id = c.owner
       WHERE c.entry_id = $1 AND NOT c.hidden AND c.kind IN ('supports','disputes','worked','didnt')
       ORDER BY 1 DESC LIMIT 200`,
      [entryId],
    );
    items.push(...rows.map((r) => ({ ...r, at: iso(r.at) })));
  }
  return items.sort((a, b) => a.at.localeCompare(b.at));
}

/** What someone proposed, and where they collaborated, for My Space and profiles. */
export async function improvementsBy(accountId: string, viewer?: string) {
  if (!hasDatabase() || !isUuid(accountId))
    return {
      proposed: [] as Improvement[],
      collaborated: [] as Improvement[],
      tested: 0,
    };
  const own = accountId === viewer;
  const rows = await query<Row>(
    `SELECT ${columns} FROM web.improvements i JOIN web.accounts a ON a.id = i.owner
     WHERE i.owner = $1 AND NOT i.hidden ${own ? "" : "AND i.status <> 'draft'"}
     ORDER BY i.updated DESC LIMIT 50`,
    [accountId],
  );
  const joined = await query<Row>(
    `SELECT DISTINCT ON (i.id) ${columns} FROM web.improvement_events e
     JOIN web.improvements i ON i.id = e.improvement_id JOIN web.accounts a ON a.id = i.owner
     WHERE e.actor = $1 AND i.owner <> $1 AND NOT i.hidden AND i.status <> 'draft' LIMIT 50`,
    [accountId],
  );
  const [counts] = await query<{ tested: number }>(
    `SELECT count(*)::int AS tested FROM web.tests WHERE owner = $1 AND status = 'complete' AND NOT hidden`,
    [accountId],
  );
  return {
    proposed: rows.map((r) => fromRow(r)),
    collaborated: joined.map((r) => fromRow(r)),
    tested: counts?.tested ?? 0,
  };
}
