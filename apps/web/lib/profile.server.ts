import "server-only";
import { hasDatabase, query } from "./db.server";
import { StoreError, type Account } from "./store.server";

export interface Profile {
  id: string;
  publicId: string;
  name: string;
  role: string;
  affiliation: string;
  bio: string;
  interests: string[];
  purpose: string[];
  links: string[];
  created: string;
}
type Row = {
  id: string;
  public_id: string;
  name: string;
  role: string;
  affiliation: string;
  bio: string;
  interests: string;
  purpose: string;
  links: string;
  created: Date;
};
const split = (s: string) =>
  s
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean);
const fromRow = (r: Row): Profile => ({
  ...r,
  publicId: r.public_id,
  interests: split(r.interests),
  purpose: split(r.purpose),
  links: split(r.links).filter((l) => /^https?:\/\//.test(l)),
  created: r.created.toISOString().slice(0, 10),
});
const columns =
  "id, public_id, name, role, affiliation, bio, interests, purpose, links, created";

export async function profileById(id: string) {
  if (!hasDatabase()) return undefined;
  const [row] = await query<Row>(
    `SELECT ${columns} FROM web.accounts WHERE id = $1`,
    [id],
  );
  return row ? fromRow(row) : undefined;
}
export async function profileByName(name: string) {
  if (!hasDatabase()) return undefined;
  const handle =
    /^p_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.exec(
      name,
    )?.[1];
  const rows = await query<Row>(
    `SELECT ${columns} FROM web.accounts WHERE ${handle ? "public_id" : "name"} = $1 AND NOT suspended LIMIT 2`,
    [handle ?? name],
  );
  return rows.length === 1 ? fromRow(rows[0]) : undefined;
}
export const purposes = [
  ["learn", "I want to learn from others"],
  ["solve", "I’m trying to solve a problem"],
  ["share", "I want to share an experience"],
  ["collaborate", "I want to collaborate"],
] as const;

/** Update the parts of a profile someone chose to share. All optional. */
export async function updateProfile(
  account: Account,
  input: Record<string, unknown>,
) {
  const text = (v: unknown, max: number) =>
    typeof v === "string" ? v.trim().slice(0, max) : undefined;
  const list = (v: unknown, max: number) =>
    Array.isArray(v)
      ? v
          .map((x) => String(x).trim().slice(0, 60))
          .filter(Boolean)
          .slice(0, max)
          .join(", ")
      : text(v, 600);
  const updates: [string, string | undefined][] = [
    ["affiliation", text(input.affiliation, 120)],
    ["bio", text(input.bio, 600)],
    ["interests", list(input.interests, 12)],
    [
      "purpose",
      input.purpose === undefined
        ? undefined
        : ([] as unknown[])
            .concat(input.purpose)
            .filter((p) => purposes.some(([k]) => k === p))
            .join(","),
    ],
    ["links", text(input.links, 600)],
  ];
  const set = updates.filter(([, v]) => v !== undefined);
  if (!set.length) throw new StoreError("Nothing to save.");
  await query(
    `UPDATE web.accounts SET ${set.map(([k], i) => `${k} = $${i + 2}`).join(", ")} WHERE id = $1`,
    [account.id, ...set.map(([, v]) => v)],
  );
}
