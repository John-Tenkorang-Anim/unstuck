import "server-only";
import { hasDatabase, query } from "./db.server";
import { newId, StoreError, type Account } from "./store.server";

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
export interface Draft {
  id: string;
  kind: string;
  title: string;
  stage: string;
  data: Record<string, unknown>;
  updated: string;
}
/** Unpublished contributions, newest first. Only their author sees them. */
export async function myDrafts(
  account?: Pick<Account, "id">,
): Promise<Draft[]> {
  if (!account || !hasDatabase()) return [];
  const rows = await query<{
    id: string;
    kind: string;
    data: Record<string, unknown>;
    updated: Date;
  }>(
    "SELECT id, kind, data, updated FROM web.drafts WHERE owner = $1 ORDER BY updated DESC LIMIT 50",
    [account.id],
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: String(r.data.title ?? "") || "Untitled draft",
    stage: String(r.data.stage ?? ""),
    data: r.data,
    updated: r.updated.toISOString(),
  }));
}
export async function getDraft(account: Pick<Account, "id">, id: string) {
  if (!isUuid(id) || !hasDatabase()) return undefined;
  const [row] = await query<{
    id: string;
    kind: string;
    data: Record<string, unknown>;
    updated: Date;
  }>(
    "SELECT id, kind, data, updated FROM web.drafts WHERE owner = $1 AND id = $2",
    [account.id, id],
  );
  return row
    ? {
        id: row.id,
        kind: row.kind,
        title: String(row.data.title ?? "") || "Untitled draft",
        stage: String(row.data.stage ?? ""),
        data: row.data,
        updated: row.updated.toISOString(),
      }
    : undefined;
}
/** Save or update a draft; returns its id. */
export async function saveDraft(
  account: Account,
  input: { id?: unknown; kind?: unknown; data?: unknown },
) {
  const data = input.data && typeof input.data === "object" ? input.data : {};
  const json = JSON.stringify(data);
  if (json.length > 200_000)
    throw new StoreError("This draft is too long to save.");
  const kind = String(input.kind ?? "attempt").slice(0, 30);
  const id =
    typeof input.id === "string" && isUuid(input.id) ? input.id : undefined;
  if (id) {
    const rows = await query(
      "UPDATE web.drafts SET data = $3, kind = $4, updated = now() WHERE id = $1 AND owner = $2 RETURNING id",
      [id, account.id, data, kind],
    );
    if (rows.length) return id;
  }
  const fresh = newId();
  await query(
    "INSERT INTO web.drafts (id, owner, kind, data) VALUES ($1,$2,$3,$4)",
    [fresh, account.id, kind, data],
  );
  return fresh;
}
export async function deleteDraft(account: Account, id: string) {
  if (!isUuid(id)) return;
  await query("DELETE FROM web.drafts WHERE id = $1 AND owner = $2", [
    id,
    account.id,
  ]);
}
