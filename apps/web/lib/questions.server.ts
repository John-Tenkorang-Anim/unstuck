import "server-only";
import { getNotebook } from "./api";
import { isQuestion, type Community } from "./communities";
import { listCommunities } from "./communities.server";
import { responseCounts } from "./discussion.server";
import { communityEntries } from "./entries.server";
import { summarizeEntry, type EntrySummary } from "./types";

export type Show = "open" | "all" | "answered";
export interface QuestionItem {
  entry: EntrySummary;
  responses: number;
  latest: string | null;
  communities: Community[];
}

/** Everything posted to one community: public posts and community-only ones. */
export async function communityPool(slug: string) {
  const [notebook, own] = await Promise.all([
    getNotebook(),
    communityEntries(slug),
  ]);
  const seen = new Set<string>();
  return [...own.map(summarizeEntry), ...notebook.entries]
    .filter((e) => (e.communities ?? []).includes(slug))
    .filter((e) => !seen.has(e.id) && seen.add(e.id));
}

/**
 * Open questions with their response counts, filtered and paged. The pool is
 * the public feed, one community, or every community someone has joined.
 */
export async function questionItems({
  communities,
  show = "open",
  field,
  q,
  page = 1,
  size = 20,
}: {
  /** Limit to these communities, including posts shared only with them. */
  communities?: string[];
  show?: Show;
  field?: string;
  q?: string;
  page?: number;
  size?: number;
}) {
  const pool: EntrySummary[] = communities
    ? (await Promise.all(communities.map(communityPool)))
        .flat()
        .filter((e, i, all) => all.findIndex((o) => o.id === e.id) === i)
    : (await getNotebook()).entries;
  const terms = (q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const questions = pool.filter(
    (e) =>
      isQuestion(e.kind) &&
      (!field || e.topic === field) &&
      terms.every((t) => `${e.title} ${e.excerpt}`.toLowerCase().includes(t)),
  );
  const [counts, all] = await Promise.all([
    responseCounts(questions.map((e) => e.id)),
    listCommunities(),
  ]);
  const items: QuestionItem[] = questions
    .map((entry) => ({
      entry,
      responses: counts.get(entry.id)?.responses ?? 0,
      latest: counts.get(entry.id)?.latest ?? null,
      communities: (entry.communities ?? [])
        .map((slug) => all.find((c) => c.slug === slug))
        .filter((c): c is Community => !!c),
    }))
    .filter((item) =>
      show === "open"
        ? item.responses === 0
        : show === "answered"
          ? item.responses > 0
          : true,
    )
    .sort((a, b) =>
      (b.latest ?? b.entry.date).localeCompare(a.latest ?? a.entry.date),
    );
  const pages = Math.max(1, Math.ceil(items.length / size));
  return {
    total: items.length,
    open:
      questions.length - [...counts.values()].filter((c) => c.responses).length,
    page: Math.min(page, pages),
    pages,
    items: items.slice((page - 1) * size, page * size),
  };
}
