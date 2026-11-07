import "server-only";
import { examples, topics } from "./data";
import { hasDatabase, query, transaction } from "./db.server";
import {
  isQuestion,
  sampleCommunities,
  slugify,
  type Community,
  type CommunityStats,
} from "./communities";
import { clean, newId, StoreError, type Account } from "./store.server";

type Viewer = Pick<Account, "id" | "moderator"> | undefined;
type Row = {
  id: string;
  slug: string;
  owner: string;
  data: { name: string; about: string; topic: Community["topic"] };
  hidden: boolean;
};
const fromRow = (r: Row): Community => ({
  ...r.data,
  slug: r.slug,
  id: r.id,
  owner: r.owner,
  hidden: r.hidden,
});

/** A community by its address (or, for moderators' links, its id). */
export async function communityBySlug(
  slug: string,
  viewer?: Viewer,
): Promise<Community | undefined> {
  const sample = sampleCommunities.find((c) => c.slug === slug);
  if (sample) return sample;
  if (!hasDatabase() || !/^[a-z0-9-]{3,48}$|^[0-9a-f-]{36}$/.test(slug))
    return undefined;
  const [row] = await query<Row>(
    "SELECT id, slug, owner, data, hidden FROM web.communities WHERE slug = $1 OR id::text = $1",
    [slug],
  );
  if (!row) return undefined;
  if (row.hidden && !(viewer && (viewer.id === row.owner || viewer.moderator)))
    return undefined;
  return fromRow(row);
}

/** Every visible community: the samples first, then the newest ones people made. */
export async function listCommunities(): Promise<Community[]> {
  if (!hasDatabase()) return sampleCommunities;
  const rows = await query<Row>(
    "SELECT id, slug, owner, data, hidden FROM web.communities WHERE NOT hidden ORDER BY created DESC LIMIT 500",
  );
  return [...sampleCommunities, ...rows.map(fromRow)];
}

/** Addresses of the communities someone belongs to, most recently joined first. */
export async function joinedSlugs(account?: Pick<Account, "id">) {
  if (!account || !hasDatabase()) return [] as string[];
  return (
    await query<{ community: string }>(
      "SELECT community FROM web.community_members WHERE account_id = $1 ORDER BY joined DESC",
      [account.id],
    )
  ).map((r) => r.community);
}
export async function myCommunities(account?: Pick<Account, "id">) {
  const all = await listCommunities();
  return (await joinedSlugs(account))
    .map((slug) => all.find((c) => c.slug === slug))
    .filter((c): c is Community => !!c);
}

/**
 * Members, questions, unanswered questions and library size for many
 * communities at once: one grouped query each, however many there are.
 */
export async function communityStats(
  slugs: string[],
  account?: Pick<Account, "id">,
): Promise<Record<string, CommunityStats>> {
  const stats = Object.fromEntries(
    slugs.map((slug) => [
      slug,
      { members: 0, questions: 0, unanswered: 0, library: 0, joined: false },
    ]),
  ) as Record<string, CommunityStats>;
  const sampleQuestions = examples.filter((e) => isQuestion(e.kind));
  const answered = new Set<string>();
  if (hasDatabase()) {
    const [members, entries, replied, mine] = await Promise.all([
      query<{ community: string; n: number }>(
        "SELECT community, count(*)::int AS n FROM web.community_members WHERE community = ANY($1) GROUP BY community",
        [slugs],
      ),
      query<{
        slug: string;
        questions: number;
        unanswered: number;
        library: number;
      }>(
        `SELECT c AS slug,
                count(*) FILTER (WHERE e.data->>'kind' = 'problem')::int AS questions,
                count(*) FILTER (WHERE e.data->>'kind' = 'problem' AND NOT EXISTS (
                  SELECT 1 FROM web.comments m WHERE m.entry_id = e.id::text AND m.parent_id IS NULL AND NOT m.hidden))::int AS unanswered,
                count(*) FILTER (WHERE e.data->>'kind' <> 'problem')::int AS library
         FROM web.entries e, jsonb_array_elements_text(e.data->'communities') c
         WHERE NOT e.hidden AND c = ANY($1) GROUP BY c`,
        [slugs],
      ),
      query<{ entry_id: string }>(
        "SELECT DISTINCT entry_id FROM web.comments WHERE entry_id = ANY($1) AND parent_id IS NULL AND NOT hidden",
        [sampleQuestions.map((e) => e.id)],
      ),
      joinedSlugs(account),
    ]);
    members.forEach(
      (r) => stats[r.community] && (stats[r.community].members = r.n),
    );
    entries.forEach((r) => {
      const s = stats[r.slug];
      if (!s) return;
      s.questions += r.questions;
      s.unanswered += r.unanswered;
      s.library += r.library;
    });
    replied.forEach((r) => answered.add(r.entry_id));
    mine.forEach((slug) => stats[slug] && (stats[slug].joined = true));
  }
  for (const entry of examples)
    for (const slug of entry.communities ?? []) {
      const s = stats[slug];
      if (!s) continue;
      if (isQuestion(entry.kind)) {
        s.questions++;
        if (!answered.has(entry.id)) s.unanswered++;
      } else s.library++;
    }
  return stats;
}

/** Start an open community. Its creator joins it automatically. */
export async function createCommunity(
  account: Account,
  input: { name?: unknown; about?: unknown; topic?: unknown },
) {
  const name = clean.text(input.name, 3, 60, "The name");
  const about = clean.text(input.about, 10, 300, "The description");
  const topic = topics.find((t) => t === input.topic);
  if (!topic) throw new StoreError("Choose the field it belongs to.");
  const slug = slugify(name);
  if (slug.length < 3)
    throw new StoreError("Use a name with at least three letters or numbers.");
  if (sampleCommunities.some((c) => c.slug === slug))
    throw new StoreError("A community with that name already exists.");
  const id = newId();
  await transaction(async (client) => {
    const inserted = await client.query(
      "INSERT INTO web.communities (id, slug, owner, data) VALUES ($1,$2,$3,$4) ON CONFLICT (slug) DO NOTHING",
      [id, slug, account.id, { name, about, topic }],
    );
    if (!inserted.rowCount)
      throw new StoreError("A community with that name already exists.");
    await client.query(
      "INSERT INTO web.community_members (community, account_id) VALUES ($1,$2)",
      [slug, account.id],
    );
  });
  return slug;
}

/** Join or leave. Communities are open, so joining needs no approval. */
export async function setMembership(
  account: Account,
  slug: string,
  join: boolean,
) {
  if (!(await communityBySlug(slug)))
    throw new StoreError("That community doesn’t exist.", 404);
  await query(
    join
      ? "INSERT INTO web.community_members (community, account_id) VALUES ($1,$2) ON CONFLICT DO NOTHING"
      : "DELETE FROM web.community_members WHERE community = $1 AND account_id = $2",
    [slug, account.id],
  );
  const [{ n }] = await query<{ n: number }>(
    "SELECT count(*)::int AS n FROM web.community_members WHERE community = $1",
    [slug],
  );
  return { joined: join, members: n };
}
