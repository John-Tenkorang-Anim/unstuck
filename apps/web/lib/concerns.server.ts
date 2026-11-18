import "server-only";
import type { PoolClient } from "pg";
import { hasDatabase, query, transaction, showExamples } from "./db.server";
import { clean, newId, StoreError, type Account } from "./store.server";
import { atLeast } from "./workspaces.server";
import {
  concernTopics,
  concernStatus,
  validDate,
  type Concern,
  type ConcernEvent,
  type ConcernEventKind,
  type ConcernStatus,
  type Commitment,
} from "./concerns";
import {
  sampleConcerns,
  sampleConcernEvents,
  sampleCommitments,
} from "./concerns.samples";

const uuid = (s: string) =>
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(s);
const text = (v: unknown, max: number) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const visible = `(w.visibility = 'public' OR EXISTS (SELECT 1 FROM web.workspace_members m WHERE m.workspace = w.id AND m.account = $1))`;
const canRead = async (
  workspace: string,
  viewer?: Pick<Account, "id">,
  publicOnly = false,
) => {
  if (!hasDatabase() || !uuid(workspace)) return false;
  const rows = await query(
    `SELECT 1 FROM web.workspaces w WHERE w.id = $2 AND NOT w.hidden AND ${publicOnly ? `${visible} AND w.visibility = 'public'` : visible}`,
    [viewer?.id ?? null, workspace],
  );
  return rows.length > 0;
};
/** A shared parent lock permits unrelated concerns to progress in parallel and serializes role revocation. */
async function access(
  client: PoolClient,
  workspace: string,
  account: Account,
  exclusive = false,
) {
  if (!uuid(workspace))
    throw new StoreError("That workspace is unavailable.", 404);
  const {
    rows: [row],
  } = await client.query<{
    visibility: string;
    role?: "viewer" | "contributor" | "editor" | "owner";
  }>(
    `SELECT w.visibility, m.role FROM web.workspaces w LEFT JOIN web.workspace_members m ON m.workspace = w.id AND m.account = $2
     WHERE w.id = $1 AND NOT w.hidden FOR ${exclusive ? "UPDATE" : "SHARE"} OF w`,
    [workspace, account.id],
  );
  if (!row || (row.visibility !== "public" && !row.role))
    throw new StoreError("That workspace is unavailable.", 404);
  return row;
}
async function contribute(
  client: PoolClient,
  workspace: string,
  account: Account,
  permission: Awaited<ReturnType<typeof access>>,
) {
  if (!permission.role && permission.visibility === "public") {
    await client.query(
      "INSERT INTO web.workspace_members (workspace, account, role) VALUES ($1,$2,'contributor') ON CONFLICT DO NOTHING",
      [workspace, account.id],
    );
    return;
  }
  if (!atLeast(permission.role, "contributor"))
    throw new StoreError(
      "Contributors, editors and owners can contribute here.",
      403,
    );
}
function sourceUrl(value: unknown, required = false) {
  const raw = text(value, 1500);
  if (!raw && !required) return undefined;
  try {
    const url = new URL(raw, "https://unstuck.invalid");
    if (
      !/^https?:$/.test(url.protocol) ||
      url.username ||
      url.password ||
      /[\u0000-\u001f\\]/.test(raw) ||
      raw.startsWith("//") ||
      (!/^https?:\/\//.test(raw) && !raw.startsWith("/"))
    )
      throw new Error();
    return raw;
  } catch {
    throw new StoreError(
      "Add a valid evidence or source link (https://… or a record on Unstuck).",
    );
  }
}
async function journal(
  client: PoolClient,
  concern: string,
  actor: string,
  kind: ConcernEventKind,
  body: string,
  data: ConcernEvent["data"] = {},
) {
  const id = newId();
  await client.query(
    "INSERT INTO web.concern_events (id, concern, actor, kind, body, data) VALUES ($1,$2,$3,$4,$5,$6)",
    [id, concern, actor, kind, body, data],
  );
  return id;
}
async function lockedConcern(
  client: PoolClient,
  workspace: string,
  id: string,
) {
  if (!uuid(id)) throw new StoreError("That concern is unavailable.", 404);
  const {
    rows: [row],
  } = await client.query<{
    id: string;
    owner: string;
    status: ConcernStatus;
    version: number;
  }>(
    "SELECT id, owner, status, version FROM web.workspace_concerns WHERE id = $1 AND workspace = $2 AND NOT hidden FOR UPDATE",
    [id, workspace],
  );
  if (!row) throw new StoreError("That concern is unavailable.", 404);
  return row;
}
export async function raiseConcern(
  account: Account,
  workspace: string,
  input: Record<string, unknown>,
) {
  const title = clean.text(input.title, 8, 180, "The concern title");
  const body = clean.text(input.body, 20, 12000, "What is happening");
  const requested = clean.text(
    input.requestedAction,
    10,
    2000,
    "The change you are asking for",
  );
  const source = sourceUrl(input.source);
  return transaction(async (client) => {
    const permission = await access(client, workspace, account, true);
    await contribute(client, workspace, account, permission);
    const {
      rows: [counter],
    } = await client.query<{ n: number }>(
      "UPDATE web.workspaces SET concern_sequence = concern_sequence + 1, updated = now() WHERE id = $1 RETURNING concern_sequence::int AS n",
      [workspace],
    );
    const id = newId();
    await client.query(
      "INSERT INTO web.workspace_concerns (id,workspace,number,owner,title,body,place,topic,requested_action) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        id,
        workspace,
        counter.n,
        account.id,
        title,
        body,
        text(input.place, 160),
        concernTopics.find((t) => t === input.topic) ?? "Other",
        requested,
      ],
    );
    await journal(client, id, account.id, "raised", body, { source });
    await client.query(
      "INSERT INTO web.concern_support (concern,account) VALUES ($1,$2)",
      [id, account.id],
    );
    return id;
  });
}
export async function supportConcern(
  account: Account,
  workspace: string,
  id: string,
  on: boolean,
) {
  return transaction(async (client) => {
    const permission = await access(client, workspace, account);
    await contribute(client, workspace, account, permission);
    await lockedConcern(client, workspace, id);
    await client.query(
      on
        ? "INSERT INTO web.concern_support (concern,account) VALUES ($1,$2) ON CONFLICT DO NOTHING"
        : "DELETE FROM web.concern_support WHERE concern = $1 AND account = $2",
      [id, account.id],
    );
    const {
      rows: [row],
    } = await client.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM web.concern_support WHERE concern = $1",
      [id],
    );
    return { supporters: row.n, supporting: on };
  });
}
export async function updateConcern(
  account: Account,
  workspace: string,
  id: string,
  input: Record<string, unknown>,
) {
  const kind = [
    "note",
    "evidence",
    "response",
    "progress",
    "status",
    "commitment",
    "completion",
  ].find((k) => k === input.kind) as ConcernEventKind | undefined;
  if (!kind) throw new StoreError("Choose a contribution type.");
  const body = clean.text(input.body, 10, 12000, "Your update");
  const source = sourceUrl(
    input.source,
    kind === "evidence" ||
      kind === "completion" ||
      (kind === "status" && input.status === "resolved"),
  );
  return transaction(async (client) => {
    const permission = await access(client, workspace, account);
    await contribute(client, workspace, account, permission);
    const concern = await lockedConcern(client, workspace, id);
    const data: ConcernEvent["data"] = { source };
    if (kind === "status") {
      if (!atLeast(permission.role, "editor"))
        throw new StoreError(
          "Only workspace editors and owners change a concern’s status.",
          403,
        );
      if (Number(input.version) !== concern.version)
        throw new StoreError(
          "This record changed. Refresh and review the latest update before changing its status.",
          409,
        );
      const status = Object.keys(concernStatus).find(
        (s) => s === input.status,
      ) as ConcernStatus | undefined;
      if (!status || status === concern.status)
        throw new StoreError("Choose a different status.");
      const allowed: Record<ConcernStatus, ConcernStatus[]> = {
        open: ["acknowledged", "in_progress"],
        acknowledged: ["open", "in_progress", "resolved"],
        in_progress: ["open", "acknowledged", "resolved"],
        resolved: ["open"],
      };
      if (!allowed[concern.status].includes(status))
        throw new StoreError(
          "Acknowledge or start work before resolving this concern. Resolved concerns can be reopened.",
        );
      data.from = concern.status;
      data.to = status;
      await client.query(
        "UPDATE web.workspace_concerns SET status = $2 WHERE id = $1",
        [id, status],
      );
    }
    if (kind === "response") {
      data.organization = text(input.organization, 160) || undefined;
      data.mode = input.mode === "recorded" ? "recorded" : "direct";
      if (data.mode === "recorded" && !source)
        throw new StoreError(
          "Link the original response when recording someone else’s statement.",
        );
    }
    if (kind === "commitment") {
      const due = validDate(input.due);
      if (!due)
        throw new StoreError("Choose a real calendar date for the commitment.");
      data.commitment = newId();
      data.due = due;
      data.responsible = clean.text(
        input.responsible,
        2,
        160,
        "Who will take the action",
      );
      data.organization = text(input.organization, 160) || undefined;
      if (input.mode === "recorded" && !source)
        throw new StoreError(
          "Link the source for a commitment recorded on someone else’s behalf.",
        );
      data.mode = input.mode === "recorded" ? "recorded" : "direct";
    }
    if (kind === "completion") {
      if (!uuid(String(input.commitment)))
        throw new StoreError("Choose a commitment.");
      const {
        rows: [commitment],
      } = await client.query<{ owner: string; completed?: Date }>(
        "SELECT owner,completed FROM web.concern_commitments WHERE id = $1 AND concern = $2 FOR UPDATE",
        [input.commitment, id],
      );
      if (!commitment)
        throw new StoreError("That commitment is unavailable.", 404);
      if (
        commitment.owner !== account.id &&
        !atLeast(permission.role, "editor")
      )
        throw new StoreError(
          "The contributor who recorded this commitment or a workspace editor can record its completion.",
          403,
        );
      if (commitment.completed)
        throw new StoreError("Completion has already been recorded.", 409);
      data.commitment = String(input.commitment);
    }
    const eventId = await journal(client, id, account.id, kind, body, data);
    if (kind === "commitment")
      await client.query(
        "INSERT INTO web.concern_commitments (id,concern,event,owner,title,responsible,due) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [
          data.commitment,
          id,
          eventId,
          account.id,
          body.slice(0, 240),
          data.responsible,
          data.due,
        ],
      );
    if (kind === "completion")
      await client.query(
        "UPDATE web.concern_commitments SET completed = now(), completion_event = $2 WHERE id = $1",
        [data.commitment, eventId],
      );
    await client.query(
      "UPDATE web.workspace_concerns SET version = version + 1, updated = now() WHERE id = $1",
      [id],
    );
    return eventId;
  });
}

type Row = {
  id: string;
  workspace: string;
  workspace_title: string;
  number: number;
  owner: string;
  title: string;
  body: string;
  place: string;
  topic: string;
  requested_action: string;
  status: ConcernStatus;
  version: number;
  author: string;
  handle: string;
  supporters: number;
  supporting: boolean;
  responses: number;
  overdue: number;
  created: Date;
  updated: Date;
};
const select = `SELECT c.*, w.data->>'title' AS workspace_title, a.name AS author, a.public_id::text AS handle,
 (SELECT count(*)::int FROM web.concern_support s WHERE s.concern = c.id) AS supporters,
 EXISTS (SELECT 1 FROM web.concern_support s WHERE s.concern = c.id AND s.account = $1) AS supporting,
 (SELECT count(*)::int FROM web.concern_events e WHERE e.concern = c.id AND e.kind = 'response' AND NOT e.hidden) AS responses,
 (SELECT count(*)::int FROM web.concern_commitments k JOIN web.concern_events e ON e.id = k.event WHERE k.concern = c.id AND k.completed IS NULL AND k.due < (now() AT TIME ZONE 'UTC')::date AND NOT e.hidden) AS overdue
 FROM web.workspace_concerns c JOIN web.workspaces w ON w.id = c.workspace JOIN web.accounts a ON a.id = c.owner`;
const fromRow = (r: Row): Concern => ({
  id: r.id,
  workspace: r.workspace,
  workspaceTitle: r.workspace_title,
  number: r.number,
  title: r.title,
  body: r.body,
  place: r.place,
  topic: r.topic,
  requestedAction: r.requested_action,
  status: r.status,
  version: r.version,
  author: r.author,
  authorHandle: `p_${r.handle}`,
  supporters: r.supporters,
  supporting: r.supporting,
  responses: r.responses,
  overdue: r.overdue,
  created: r.created.toISOString(),
  updated: r.updated.toISOString(),
});
export async function getConcern(
  workspace: string,
  id: string,
  viewer?: Pick<Account, "id">,
  publicOnly = false,
): Promise<Concern | undefined> {
  const sample = showExamples()
    ? sampleConcerns.find((c) => c.id === id && c.workspace === workspace)
    : undefined;
  if (sample) return sample;
  if (!hasDatabase() || !uuid(id) || !uuid(workspace)) return undefined;
  const [row] = await query<Row>(
    `${select} WHERE c.id = $2 AND c.workspace = $3 AND NOT c.hidden AND NOT w.hidden AND ${publicOnly ? `${visible} AND w.visibility = 'public'` : visible}`,
    [viewer?.id ?? null, id, workspace],
  );
  return row ? fromRow(row) : undefined;
}
export interface ConcernFilter {
  workspace?: string;
  q?: string;
  place?: string;
  status?: string;
  topic?: string;
  attention?: boolean;
  page?: number;
  size?: number;
  publicOnly?: boolean;
}
/** Search and pagination happen in SQL before the slice, so old records never vanish behind a feed limit. */
export async function listConcerns(
  filter: ConcernFilter = {},
  viewer?: Pick<Account, "id">,
) {
  const size = Math.max(1, Math.min(50, filter.size ?? 20)),
    page = Math.max(1, Math.floor(Number(filter.page) || 1));
  const samples = (showExamples() ? sampleConcerns : []).filter(
    (c) =>
      (!filter.workspace || c.workspace === filter.workspace) &&
      (!filter.place ||
        c.place.toLowerCase().includes(filter.place.toLowerCase())) &&
      (!filter.status || c.status === filter.status) &&
      (!filter.topic || c.topic === filter.topic) &&
      (!filter.attention || (c.status !== "resolved" && c.responses === 0)) &&
      (!filter.q ||
        `${c.title} ${c.body} ${c.place}`
          .toLowerCase()
          .includes(filter.q.toLowerCase())),
  );
  if (!hasDatabase() || (filter.workspace && !uuid(filter.workspace)))
    return {
      items: samples.slice((page - 1) * size, page * size),
      total: samples.length,
      page,
      pages: Math.max(1, Math.ceil(samples.length / size)),
    };
  const values: unknown[] = [viewer?.id ?? null];
  const clause = [
    "NOT c.hidden",
    "NOT w.hidden",
    filter.publicOnly ? `${visible} AND w.visibility = 'public'` : visible,
  ];
  const add = (sql: string, value: unknown) => {
    values.push(value);
    clause.push(sql.replace("?", `$${values.length}`));
  };
  if (filter.workspace) add("c.workspace = ?::uuid", filter.workspace);
  if (filter.q)
    add(
      "to_tsvector('simple', c.title || ' ' || c.body || ' ' || c.place) @@ websearch_to_tsquery('simple', ?)",
      text(filter.q, 200),
    );
  if (filter.place)
    add("c.place ILIKE '%' || ? || '%'", text(filter.place, 160));
  if (filter.status) add("c.status = ?", filter.status);
  if (filter.topic) add("c.topic = ?", filter.topic);
  if (filter.attention)
    clause.push(
      "c.status <> 'resolved' AND NOT EXISTS (SELECT 1 FROM web.concern_events e WHERE e.concern = c.id AND e.kind = 'response' AND NOT e.hidden)",
    );
  const where = clause.join(" AND ");
  // Count independently: even an out-of-range page retains the correct total.
  const [{ n }] = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM web.workspace_concerns c JOIN web.workspaces w ON w.id = c.workspace WHERE ${where}`,
    values,
  );
  const rows = await query<Row>(
    `${select} WHERE ${where} ORDER BY (c.status = 'resolved'), c.created ASC, c.id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, size, (page - 1) * size],
  );
  // Demonstrations are separate, labelled in their own workspaces; live pagination never incorporates fake counts.
  return {
    items: rows.map(fromRow),
    total: n,
    page,
    pages: Math.max(1, Math.ceil(n / size)),
  };
}
export async function concernEvents(
  workspace: string,
  id: string,
  viewer?: Pick<Account, "id">,
  before?: string,
  publicOnly = false,
) {
  if (
    showExamples() &&
    sampleConcerns.some((c) => c.id === id && c.workspace === workspace)
  )
    return {
      items: sampleConcernEvents[id] ?? [],
      next: undefined as string | undefined,
    };
  if (!(await canRead(workspace, viewer, publicOnly)))
    return { items: [], next: undefined as string | undefined };
  const cursor = before && /^\d{1,19}$/.test(before) ? before : null;
  const rows = await query<{
    id: string;
    sequence: string;
    kind: ConcernEventKind;
    body: string;
    data: ConcernEvent["data"];
    author: string;
    handle: string;
    created: Date;
  }>(
    `SELECT e.id,e.sequence::text,e.kind,e.body,e.data,a.name AS author,a.public_id::text AS handle,e.created FROM web.concern_events e
     JOIN web.workspace_concerns c ON c.id = e.concern JOIN web.accounts a ON a.id = e.actor
     WHERE e.concern = $1 AND c.workspace = $2 AND NOT c.hidden AND NOT e.hidden AND ($3::bigint IS NULL OR e.sequence < $3::bigint)
     ORDER BY e.sequence DESC LIMIT 41`,
    [id, workspace, cursor],
  );
  const items: ConcernEvent[] = rows.slice(0, 40).map((r) => ({
    ...r,
    authorHandle: `p_${r.handle}`,
    created: r.created.toISOString(),
  }));
  return { items, next: rows.length > 40 ? items.at(-1)!.sequence : undefined };
}
export async function commitmentsFor(
  workspace: string,
  id: string,
  viewer?: Pick<Account, "id">,
  publicOnly = false,
): Promise<Commitment[]> {
  if (
    showExamples() &&
    sampleConcerns.some((c) => c.id === id && c.workspace === workspace)
  )
    return sampleCommitments[id] ?? [];
  if (!(await canRead(workspace, viewer, publicOnly))) return [];
  return query<Commitment>(
    `SELECT k.id,k.title,k.responsible,k.due::text,k.completed::text,
    (k.owner = $3 OR EXISTS (SELECT 1 FROM web.workspace_members m WHERE m.workspace = $2 AND m.account = $3 AND m.role IN ('owner','editor'))) AS "canComplete"
    FROM web.concern_commitments k JOIN web.workspace_concerns c ON c.id = k.concern JOIN web.concern_events e ON e.id = k.event
    WHERE k.concern = $1 AND c.workspace = $2 AND NOT c.hidden AND NOT e.hidden ORDER BY k.completed NULLS FIRST,k.due,k.id LIMIT 100`,
    [id, workspace, viewer?.id ?? null],
  );
}

/**
 * What changed on concerns someone raised or supports: other people’s updates
 * in the last 45 days, and commitments that passed their date. Membership is
 * rechecked so a revoked member stops hearing about a private workspace.
 */
export async function concernActivity(account: Pick<Account, "id">) {
  if (!hasDatabase()) return { updates: [], overdue: [] };
  const mine = `c.id IN (SELECT concern FROM web.concern_support WHERE account = $1) AND NOT c.hidden AND NOT w.hidden AND ${visible}`;
  const updates = await query<{
    workspace: string;
    concern: string;
    number: number;
    title: string;
    kind: ConcernEventKind;
    body: string;
    actor: string;
    created: Date;
  }>(
    `SELECT c.workspace, c.id AS concern, c.number, c.title, e.kind, e.body, a.name AS actor, e.created
     FROM web.concern_events e JOIN web.workspace_concerns c ON c.id = e.concern JOIN web.workspaces w ON w.id = c.workspace
     JOIN web.accounts a ON a.id = e.actor
     WHERE ${mine} AND e.actor <> $1 AND NOT e.hidden AND e.kind <> 'raised' AND e.created > now() - interval '45 days'
     ORDER BY e.created DESC LIMIT 40`,
    [account.id],
  );
  const overdue = await query<{
    workspace: string;
    concern: string;
    number: number;
    title: string;
    commitment: string;
    due: string;
  }>(
    `SELECT c.workspace, c.id AS concern, c.number, c.title, k.title AS commitment, k.due::text
     FROM web.concern_commitments k JOIN web.workspace_concerns c ON c.id = k.concern JOIN web.workspaces w ON w.id = c.workspace
     JOIN web.concern_events e ON e.id = k.event
     WHERE ${mine} AND NOT e.hidden AND k.completed IS NULL AND k.due < (now() AT TIME ZONE 'UTC')::date
     ORDER BY k.due LIMIT 20`,
    [account.id],
  );
  return { updates, overdue };
}
