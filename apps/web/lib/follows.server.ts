import "server-only";
import { hasDatabase, query } from "./db.server";
import { StoreError, type Account } from "./store.server";

export type FollowType =
  "problem" | "improvement" | "category" | "person" | "workspace";
const types: FollowType[] = [
  "problem",
  "improvement",
  "category",
  "person",
  "workspace",
];

export async function isFollowing(
  account: Account | undefined,
  type: FollowType,
  id: string,
) {
  if (!account || !hasDatabase()) return false;
  const rows = await query(
    "SELECT 1 FROM web.follows WHERE account = $1 AND target_type = $2 AND target_id = $3",
    [account.id, type, id],
  );
  return rows.length > 0;
}
export async function followers(type: FollowType, id: string) {
  if (!hasDatabase()) return 0;
  const [row] = await query<{ n: number }>(
    "SELECT count(*)::int AS n FROM web.follows WHERE target_type = $1 AND target_id = $2",
    [type, id],
  );
  return row?.n ?? 0;
}
export async function setFollow(
  account: Account,
  type: unknown,
  id: unknown,
  on: boolean,
) {
  if (!types.includes(type as FollowType))
    throw new StoreError("Choose what to follow.");
  const target = String(id ?? "").slice(0, 200);
  if (!target) throw new StoreError("Choose what to follow.");
  await query(
    on
      ? "INSERT INTO web.follows (account, target_type, target_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING"
      : "DELETE FROM web.follows WHERE account = $1 AND target_type = $2 AND target_id = $3",
    [account.id, type, target],
  );
}
export async function following(account?: Pick<Account, "id">) {
  if (!account || !hasDatabase())
    return [] as { type: FollowType; id: string; created: Date }[];
  return query<{ type: FollowType; id: string; created: Date }>(
    "SELECT target_type AS type, target_id AS id, created FROM web.follows WHERE account = $1 ORDER BY created DESC LIMIT 200",
    [account.id],
  );
}
