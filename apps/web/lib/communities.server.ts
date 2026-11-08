import "server-only";
import { examples, topics } from "./data";
import { hasDatabase, query, transaction } from "./db.server";
import {
  isQuestion,
  sampleCommunities,
  slugify,
  type Community,
  type CommunityStats,
  type Member,
} from "./communities";
import { clean, newId, StoreError, type Account } from "./store.server";

type Viewer = Pick<Account, "id" | "moderator"> | undefined;
type Row = {
  id: string;
  slug: string;
  owner: string;
  data: {
    name: string;
    about: string;
    topic: Community["topic"];
    rules?: string[];
  };
  hidden: boolean;
};
const fromRow = (r: Row): Community => ({
  ...r.data,
  rules: r.data.rules ?? [],
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
  input: { name?: unknown; about?: unknown; topic?: unknown; rules?: unknown },
) {
  const name = clean.text(input.name, 3, 60, "The name");
  const about = clean.text(input.about, 10, 300, "The description");
  const rawRules = Array.isArray(input.rules)
    ? input.rules
    : typeof input.rules === "string"
      ? input.rules.split("\n")
      : [];
  const rules = rawRules.map((rule) => String(rule).trim()).filter(Boolean);
  if (!rules.length || rules.length > 5)
    throw new StoreError("Write between one and five rules for members.");
  rules.forEach((rule) => clean.text(rule, 3, 200, "Each rule"));
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
      [id, slug, account.id, { name, about, topic, rules }],
    );
    if (!inserted.rowCount)
      throw new StoreError("A community with that name already exists.");
    await client.query(
      "INSERT INTO web.community_members (community, account_id, agreed) VALUES ($1,$2,now())",
      [slug, account.id],
    );
  });
  return slug;
}

/**
 * Join or leave. Communities are open, so nobody approves a member, but
 * joining means agreeing to the community's rules. An introduction is optional.
 */
export async function setMembership(
  account: Account,
  slug: string,
  join: boolean,
  input: { agree?: unknown; intro?: unknown } = {},
) {
  if (!(await communityBySlug(slug)))
    throw new StoreError("That community doesn’t exist.", 404);
  if (join) {
    if (input.agree !== true)
      throw new StoreError("Agree to the community’s rules to join.");
    const intro =
      typeof input.intro === "string" ? input.intro.trim().slice(0, 280) : "";
    await query(
      `INSERT INTO web.community_members (community, account_id, intro, agreed) VALUES ($1,$2,$3,now())
       ON CONFLICT (community, account_id) DO UPDATE SET intro = EXCLUDED.intro, agreed = now()`,
      [slug, account.id, intro],
    );
  } else
    await query(
      "DELETE FROM web.community_members WHERE community = $1 AND account_id = $2",
      [slug, account.id],
    );
  const [{ n }] = await query<{ n: number }>(
    "SELECT count(*)::int AS n FROM web.community_members WHERE community = $1",
    [slug],
  );
  return { joined: join, members: n };
}

/** Newest members first, with their introductions. Paged for large communities. */
export async function listMembers(slug: string, page = 1, size = 50) {
  if (!hasDatabase()) return { items: [] as Member[], pages: 1 };
  const [rows, [{ n }]] = await Promise.all([
    query<{ name: string; role: string; intro: string; joined: Date }>(
      `SELECT a.name, a.role, m.intro, m.joined FROM web.community_members m
       JOIN web.accounts a ON a.id = m.account_id AND NOT a.suspended
       WHERE m.community = $1 ORDER BY m.joined DESC LIMIT $2 OFFSET $3`,
      [slug, size, (page - 1) * size],
    ),
    query<{ n: number }>(
      "SELECT count(*)::int AS n FROM web.community_members WHERE community = $1",
      [slug],
    ),
  ]);
  return {
    items: rows.map((r) => ({ ...r, joined: r.joined.toISOString() })),
    pages: Math.max(1, Math.ceil(n / size)),
  };
}

export type CommunitySort = "members" | "newest" | "name";
/**
 * The directory, for any number of communities: search, field filter, sort
 * and paging happen in one query. Sample communities are passed in as rows so
 * they sort alongside everyone else's.
 */
export async function searchCommunities({
  q = "",
  field = "",
  sort = "members",
  page = 1,
  size = 30,
}: {
  q?: string;
  field?: string;
  sort?: CommunitySort;
  page?: number;
  size?: number;
}) {
  const text = q.trim().slice(0, 100);
  if (!hasDatabase()) {
    const terms = text.toLowerCase().split(/\s+/).filter(Boolean);
    const items = sampleCommunities
      .filter(
        (c) =>
          (!field || c.topic === field) &&
          terms.every((t) => `${c.name} ${c.about}`.toLowerCase().includes(t)),
      )
      .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : 0));
    return {
      items: items
        .slice((page - 1) * size, page * size)
        .map((c) => ({ ...c, members: 0 })),
      total: items.length,
      pages: Math.max(1, Math.ceil(items.length / size)),
    };
  }
  const order =
    sort === "name"
      ? "lower(name) ASC"
      : sort === "newest"
        ? "created DESC, lower(name) ASC"
        : "members DESC, lower(name) ASC";
  const rows = await query<{
    slug: string;
    name: string;
    about: string;
    topic: Community["topic"];
    rules: string[] | null;
    sample: boolean;
    id: string | null;
    members: number;
    total: number;
  }>(
    `WITH everyone AS (
       SELECT s.slug, s.name, s.about, s.topic, s.rules, true AS sample, NULL::uuid AS id,
              'epoch'::timestamptz AS created
       FROM jsonb_to_recordset($1::jsonb) AS s(slug text, name text, about text, topic text, rules jsonb)
       UNION ALL
       SELECT c.slug, c.data->>'name', c.data->>'about', c.data->>'topic', c.data->'rules', false, c.id, c.created
       FROM web.communities c WHERE NOT c.hidden
     ), matched AS (
       SELECT e.*, coalesce((SELECT count(*) FROM web.community_members m WHERE m.community = e.slug), 0)::int AS members
       FROM everyone e
       WHERE ($2 = '' OR e.topic = $2)
         AND ($3 = '' OR to_tsvector('simple', e.name || ' ' || e.about) @@ websearch_to_tsquery('simple', $3)
              OR e.name ILIKE '%' || $3 || '%')
     )
     SELECT slug, name, about, topic, rules, sample, id, members, count(*) OVER ()::int AS total
     FROM matched ORDER BY ${order} LIMIT $4 OFFSET $5`,
    [JSON.stringify(sampleCommunities), field, text, size, (page - 1) * size],
  );
  const total = rows[0]?.total ?? 0;
  return {
    items: rows.map((r): Community & { members: number } => ({
      slug: r.slug,
      name: r.name,
      about: r.about,
      topic: r.topic,
      rules: (r.rules as string[] | null) ?? [],
      ...(r.sample ? { sample: true } : { id: r.id ?? undefined }),
      members: r.members,
    })),
    total,
    pages: Math.max(1, Math.ceil(total / size)),
  };
}
