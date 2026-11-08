import "server-only";
import type { PoolClient } from "pg";
import { hasDatabase, query, showExamples, transaction } from "./db.server";
import { getProblem } from "./problems.server";
import { clean, newId, StoreError, type Account } from "./store.server";
import {
  sampleWorkspaces,
  type ItemKind,
  type Member,
  type Role,
  type Visibility,
  type Workspace,
  type WorkspaceItem,
} from "./workspaces";

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
const text = (v: unknown, max = 2000) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
const lines = (v: unknown) =>
  String(v ?? "")
    .split("\n")
    .map((x) => x.trim().slice(0, 300))
    .filter(Boolean)
    .slice(0, 10);
type Head = Pick<
  Workspace,
  "title" | "goal" | "strategy" | "progress" | "questions" | "next"
>;
type Row = {
  id: string;
  owner: string;
  problem_id: string | null;
  visibility: Visibility;
  data: Head;
  created: Date;
  updated: Date;
};
const ranks: Role[] = ["viewer", "contributor", "editor", "owner"];
export const atLeast = (role: Role | undefined, need: Role) =>
  !!role && ranks.indexOf(role) >= ranks.indexOf(need);

/** Workspaces someone can see: public ones, and any they belong to. */
export async function listWorkspaces(viewer?: string) {
  if (!hasDatabase()) return showExamples() ? sampleWorkspaces : [];
  const rows = await query<Row & { members: number; member: boolean }>(
    `SELECT w.*, (SELECT count(*)::int FROM web.workspace_members m WHERE m.workspace = w.id) AS members,
      EXISTS (SELECT 1 FROM web.workspace_members m WHERE m.workspace = w.id AND m.account = $1) AS member
     FROM web.workspaces w WHERE NOT w.hidden AND (w.visibility <> 'private'
       OR EXISTS (SELECT 1 FROM web.workspace_members m WHERE m.workspace = w.id AND m.account = $1))
     ORDER BY w.updated DESC LIMIT 100`,
    [viewer && isUuid(viewer) ? viewer : null],
  );
  const live: Workspace[] = rows.map((r) => ({
    ...(r.visibility === "public" || r.member
      ? r.data
      : {
          title: r.data.title,
          goal: "",
          strategy: "",
          progress: "",
          questions: [],
          next: [],
        }),
    id: r.id,
    problemId:
      r.visibility === "public" || r.member
        ? (r.problem_id ?? undefined)
        : undefined,
    visibility: r.visibility,
    owner: r.owner,
    members: [],
    memberCount: r.members,
    items: [],
    created: r.created.toISOString(),
    updated: r.updated.toISOString(),
  }));
  return [...live, ...(showExamples() ? sampleWorkspaces : [])];
}

/** One workspace with members and items, and the viewer’s role in it. */
export async function getWorkspace(id: string, viewer?: Account) {
  const sample = (showExamples() ? sampleWorkspaces : []).find(
    (w) => w.id === id,
  );
  if (sample) return { workspace: sample, role: undefined as Role | undefined };
  if (!hasDatabase() || !isUuid(id)) return undefined;
  const [row] = await query<Row>(
    "SELECT * FROM web.workspaces WHERE id = $1 AND NOT hidden",
    [id],
  );
  if (!row) return undefined;
  const members = await query<{
    account: string;
    name: string;
    role: Role;
    focus: string;
  }>(
    `SELECT m.account, a.name, m.role, m.focus FROM web.workspace_members m
     JOIN web.accounts a ON a.id = m.account WHERE m.workspace = $1 ORDER BY m.joined`,
    [id],
  );
  const role = members.find((m) => m.account === viewer?.id)?.role;
  if (row.visibility !== "public" && !role && !viewer?.moderator)
    return undefined;
  const items = await query<{
    id: string;
    kind: ItemKind;
    status: string;
    data: Omit<
      WorkspaceItem,
      "id" | "kind" | "status" | "by" | "created" | "updated"
    >;
    owner: string;
    by: string;
    created: Date;
    updated: Date;
  }>(
    `SELECT i.*, a.name AS by FROM web.workspace_items i JOIN web.accounts a ON a.id = i.owner
     WHERE i.workspace = $1 AND NOT i.hidden ORDER BY i.updated DESC LIMIT 500`,
    [id],
  );
  const workspace: Workspace = {
    ...row.data,
    id: row.id,
    problemId: row.problem_id ?? undefined,
    visibility: row.visibility,
    owner: row.owner,
    members: members.map<Member>((m) => ({
      name: m.name,
      role: m.role,
      focus: m.focus,
    })),
    items: items.map((i) => ({
      ...i.data,
      id: i.id,
      kind: i.kind,
      status: i.status,
      by: i.by,
      owner: i.owner,
      created: i.created.toISOString(),
      updated: i.updated.toISOString(),
    })),
    created: row.created.toISOString(),
    updated: row.updated.toISOString(),
  };
  return { workspace, role };
}

export async function createWorkspace(
  account: Account,
  input: Record<string, unknown>,
) {
  const title = clean.text(input.title, 4, 140, "The workspace’s name");
  const goal = clean.text(
    input.goal,
    10,
    2000,
    "What the team is trying to achieve",
  );
  const problemId = text(input.problemId, 200) || null;
  if (problemId && !(await getProblem(problemId)))
    throw new StoreError("That problem doesn’t exist.", 404);
  const visibility =
    (["public", "restricted", "private"] as const).find(
      (v) => v === input.visibility,
    ) ?? "private";
  const id = newId();
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO web.workspaces (id, owner, problem_id, visibility, data) VALUES ($1,$2,$3,$4,$5)`,
      [
        id,
        account.id,
        problemId,
        visibility,
        {
          title,
          goal,
          strategy: text(input.strategy),
          progress: "",
          questions: lines(input.questions),
          next: lines(input.next),
        },
      ],
    );
    await client.query(
      `INSERT INTO web.workspace_members (workspace, account, role) VALUES ($1,$2,'owner')`,
      [id, account.id],
    );
  });
  return id;
}

async function roleIn(account: Account, id: string, client: PoolClient) {
  if (!isUuid(id)) throw new StoreError("That workspace doesn’t exist.", 404);
  const {
    rows: [row],
  } = await client.query<{ visibility: Visibility; role: Role | null }>(
    `SELECT w.visibility, m.role FROM web.workspaces w
     LEFT JOIN web.workspace_members m ON m.workspace = w.id AND m.account = $2
     WHERE w.id = $1 AND NOT w.hidden FOR UPDATE OF w`,
    [id, account.id],
  );
  if (!row) throw new StoreError("That workspace doesn’t exist.", 404);
  return row;
}
/** Join a public workspace as a contributor. Restricted ones need an invitation. */
export async function joinWorkspace(account: Account, id: string) {
  return transaction(async (client) => {
    const row = await roleIn(account, id, client);
    if (row.role) return row.role;
    if (row.visibility !== "public")
      throw new StoreError(
        "This workspace is invitation only. Ask its owner to add you.",
        403,
      );
    await client.query(
      `INSERT INTO web.workspace_members (workspace, account, role) VALUES ($1,$2,'contributor') ON CONFLICT DO NOTHING`,
      [id, account.id],
    );
    return "contributor" as Role;
  });
}
/** The owner sets someone’s role, by their name. */
export async function setMemberRole(
  account: Account,
  id: string,
  name: unknown,
  role: unknown,
) {
  return transaction(async (client) => {
    const me = await roleIn(account, id, client);
    if (me.role !== "owner")
      throw new StoreError("Only the owner can change roles.", 403);
    const r = (["editor", "contributor", "viewer"] as const).find(
      (x) => x === role,
    );
    if (!r) throw new StoreError("Choose a role.");
    let identifier = text(name, 300);
    if (/^(https?:\/\/|\/people\/)/.test(identifier)) {
      try {
        identifier = decodeURIComponent(
          new URL(identifier, "https://unstuck.invalid").pathname
            .replace(/^\/people\//, "")
            .replace(/\/$/, ""),
        );
      } catch {
        throw new StoreError("Use their public profile link.");
      }
    }
    const publicId =
      identifier.startsWith("p_") && isUuid(identifier.slice(2))
        ? identifier.slice(2)
        : undefined;
    const { rows: people } = await client.query<{ id: string }>(
      publicId
        ? "SELECT id FROM web.accounts WHERE public_id = $1 AND NOT suspended"
        : "SELECT id FROM web.accounts WHERE name = $1 AND NOT suspended LIMIT 2",
      [publicId ?? identifier],
    );
    if (people.length > 1)
      throw new StoreError(
        "More than one person uses that name. Ask them for their profile link.",
        409,
      );
    const person = people[0];
    if (!person) throw new StoreError("No one goes by that name.", 404);
    if (person.id === account.id) throw new StoreError("You’re the owner.");
    await client.query(
      `INSERT INTO web.workspace_members (workspace, account, role) VALUES ($1,$2,$3)
     ON CONFLICT (workspace, account) DO UPDATE SET role = $3`,
      [id, person.id, r],
    );
  });
}

const statusFor: Record<ItemKind, string[]> = {
  idea: ["proposed", "review", "ready", "evaluated"],
  task: ["todo", "doing", "done"],
  test: ["planned", "running", "complete"],
  evidence: ["observation", "measurement", "document", "attempt"],
  decision: ["decided"],
};
/** Add an idea, task, test, piece of evidence or decision. */
export async function addItem(
  account: Account,
  id: string,
  input: Record<string, unknown>,
) {
  return transaction(async (client) => {
    const { role } = await roleIn(account, id, client);
    const kind = input.kind as ItemKind;
    if (!Object.hasOwn(statusFor, kind))
      throw new StoreError("Choose what you’re adding.");
    const need: Role =
      kind === "task" || kind === "decision" ? "editor" : "contributor";
    if (!atLeast(role ?? undefined, need))
      throw new StoreError(
        need === "editor"
          ? "Editors and owners add tasks and decisions."
          : "Join the workspace to add to it.",
        403,
      );
    const title = clean.text(input.title, 3, 160, "The title");
    const status = statusFor[kind].includes(String(input.status))
      ? String(input.status)
      : statusFor[kind][0];
    const href = text(input.href, 300);
    const data = {
      title,
      body: text(input.body),
      assignee: text(input.assignee, 80) || undefined,
      due: /^\d{4}-\d{2}-\d{2}$/.test(String(input.due))
        ? String(input.due)
        : undefined,
      why: text(input.why) || undefined,
      participants: lines(input.participants).length
        ? lines(input.participants)
        : undefined,
      open: kind === "decision" ? input.open !== false : undefined,
      link: /^\/(?![\\/])[^\\]*$/.test(href)
        ? { label: text(input.linkLabel, 40) || "Link", href }
        : undefined,
    };
    const itemId = newId();
    await client.query(
      `INSERT INTO web.workspace_items (id, workspace, owner, kind, status, data) VALUES ($1,$2,$3,$4,$5,$6)`,
      [itemId, id, account.id, kind, status, data],
    );
    await client.query(
      "UPDATE web.workspaces SET updated = now() WHERE id = $1",
      [id],
    );
    return itemId;
  });
}
/** Move an item along its board. Contributors can move their own; editors any. */
export async function moveItem(
  account: Account,
  id: string,
  itemId: string,
  status: unknown,
) {
  return transaction(async (client) => {
    const { role } = await roleIn(account, id, client);
    if (!isUuid(itemId)) throw new StoreError("That item doesn’t exist.", 404);
    const {
      rows: [item],
    } = await client.query<{ kind: ItemKind; owner: string }>(
      "SELECT kind, owner FROM web.workspace_items WHERE id = $1 AND workspace = $2 AND NOT hidden",
      [itemId, id],
    );
    if (!item) throw new StoreError("That item doesn’t exist.", 404);
    if (!(
      atLeast(role ?? undefined, "editor") ||
      (atLeast(role ?? undefined, "contributor") && item.owner === account.id)
    ))
      throw new StoreError(
        "Editors and owners can move other people’s items.",
        403,
      );
    if (!statusFor[item.kind].includes(String(status)))
      throw new StoreError("That column doesn’t exist.");
    await client.query(
      "UPDATE web.workspace_items SET status = $2, updated = now() WHERE id = $1",
      [itemId, status],
    );
    await client.query(
      "UPDATE web.workspaces SET updated = now() WHERE id = $1",
      [id],
    );
  });
}

/** Restricted studios expose only their title outside the membership boundary. */
export async function workspacePreview(id: string) {
  if (!hasDatabase() || !isUuid(id)) return undefined;
  const [row] = await query<{ title: string }>(
    "SELECT data->>'title' AS title FROM web.workspaces WHERE id = $1 AND visibility = 'restricted' AND NOT hidden",
    [id],
  );
  return row;
}
/** Workspaces someone belongs to, for My Space. */
export async function myWorkspaces(account?: Pick<Account, "id">) {
  if (!account || !hasDatabase()) return [];
  return query<{ id: string; title: string; role: Role; updated: Date }>(
    `SELECT w.id, w.data->>'title' AS title, m.role, w.updated FROM web.workspace_members m
     JOIN web.workspaces w ON w.id = m.workspace WHERE m.account = $1 AND NOT w.hidden ORDER BY w.updated DESC`,
    [account.id],
  );
}

/** Profiles disclose public collaborations only, never private memberships. */
export async function publicWorkspacesBy(accountId: string) {
  if (!hasDatabase() || !isUuid(accountId)) return [];
  return query<{ id: string; title: string; role: Role; updated: Date }>(
    `SELECT w.id, w.data->>'title' AS title, m.role, w.updated FROM web.workspace_members m
     JOIN web.workspaces w ON w.id = m.workspace WHERE m.account = $1
     AND NOT w.hidden AND w.visibility = 'public' ORDER BY w.updated DESC LIMIT 100`,
    [accountId],
  );
}
