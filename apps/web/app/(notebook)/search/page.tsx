import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Play, Search } from "lucide-react";
import { OutcomeGlyph } from "@/components/glyph";
import { getCorpus } from "@/lib/search.server";
import {
  clock,
  resultTypes,
  search,
  summarize,
  type Result,
  type ResultType,
} from "@/lib/search";
import { QuestionList } from "@/components/question-list";
import { currentAccount } from "@/lib/auth.server";
import type { Community } from "@/lib/communities";
import { joinedSlugs, listCommunities } from "@/lib/communities.server";
import { hasDatabase } from "@/lib/db.server";
import { responseCounts } from "@/lib/discussion.server";
import { questionItems, type Show } from "@/lib/questions.server";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const q = (await searchParams).q;
  return {
    title: typeof q === "string" && q ? `${q} · Search` : "Search and ask",
  };
}
const one = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : "";
const suggestions = [
  "bridge twisting",
  "cold solder joint",
  "clay pot cooler",
  "3D print failed",
  "cache key",
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = one(params.q).slice(0, 200);
  const exact = one(params.exact) === "1";
  const type = (resultTypes.find((t) => t.key === one(params.type))?.key ??
    "all") as ResultType;
  // Categories are communities: anyone can create one or join it.
  const category = one(params.category);
  const show: Show =
    params.show === "all" || params.show === "answered"
      ? (params.show as Show)
      : "open";
  const where = one(params.where) === "mine" ? "mine" : "everyone";
  const page = Math.max(1, Number(one(params.page)) || 1);
  // An empty search is the home page: one box, nothing else.
  if (!q && type === "all" && !category) redirect("/discover");
  const account = hasDatabase() ? await currentAccount() : undefined;
  const [{ docs, mode }, communities, mine] = await Promise.all([
    getCorpus(),
    listCommunities().catch(() => []),
    joinedSlugs(account),
  ]);
  const ranked = search(docs, exact ? `"${q}"` : q, {
    type,
  });
  // If a corrected spelling found nothing, fall back to the words as typed.
  const unfiltered =
    ranked.results.length || !q ? ranked : { ...ranked, corrected: null };
  const { corrected } = unfiltered;
  const results = category
    ? unfiltered.results.filter((r) =>
        (r.doc.communities ?? []).includes(category),
      )
    : unfiltered.results;
  const link = (change: Record<string, string>) => {
    const next = new URLSearchParams({
      ...(q ? { q } : {}),
      ...(type !== "all" ? { type } : {}),
      ...(category ? { category } : {}),
      ...(type === "questions" && show !== "open" ? { show } : {}),
      ...(type === "questions" && where !== "everyone" ? { where } : {}),
      ...change,
    });
    for (const [key, value] of [...next]) if (!value) next.delete(key);
    return `/search${next.size ? `?${next}` : ""}`;
  };
  const questionDocs = results.filter((r) => r.doc.types.has("questions"));
  const answers = await responseCounts(questionDocs.map((r) => r.doc.id));
  // Suggest the communities where similar problems were posted, then yours.
  const suggested = [
    ...new Set([
      ...(q ? results.slice(0, 6).flatMap((r) => r.doc.communities ?? []) : []),
      ...mine,
    ]),
  ]
    .map((slug) => communities.find((c) => c.slug === slug))
    .filter((c): c is Community => !!c)
    .slice(0, 4);
  const summary = summarize(results);
  const moments = q
    ? results
        .flatMap((r) =>
          r.matched
            .filter((a) => a.kind === "moment")
            .map((anchor) => ({ anchor, result: r })),
        )
        .slice(0, 6)
    : [];
  const questions =
    type === "questions"
      ? await questionItems({
          communities: category
            ? [category]
            : where === "mine"
              ? mine
              : undefined,
          show,
          q,
          page,
        })
      : undefined;
  return (
    <div className="serp frame">
      <form className="serp-bar" action="/search" role="search">
        <Search size={20} aria-hidden="true" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="Search, or describe your problem"
          placeholder="Describe your problem, or search for it"
          autoComplete="off"
        />
        {type !== "all" && <input type="hidden" name="type" value={type} />}
        {category && <input type="hidden" name="category" value={category} />}
        {/* Search comes first so pressing Enter searches. */}
        <button className="button button-dark">Search</button>
        <button
          className="button button-outline serp-ask"
          formAction="/new"
          name="kind"
          value="problem"
          title="Post it as a question"
        >
          Ask
        </button>
      </form>
      <nav className="serp-tabs" aria-label="Result types">
        {resultTypes.map((t) => (
          <Link
            key={t.key}
            href={link({ type: t.key === "all" ? "" : t.key, page: "" })}
            aria-current={type === t.key ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="serp-fields" aria-label="Categories">
        <Link
          href={link({ category: "", page: "" })}
          aria-current={!category ? "true" : undefined}
        >
          Every category
        </Link>
        {communities.slice(0, 8).map((c) => (
          <Link
            key={c.slug}
            href={link({ category: c.slug, page: "" })}
            aria-current={category === c.slug ? "true" : undefined}
          >
            {c.name}
          </Link>
        ))}
        <Link href="/communities">All categories</Link>
      </div>
      {mode === "examples" && (
        <p className="example-notice serp-notice">
          <span className="example-tag">Sample data</span> Searching fictional
          examples and one historical case. Photos and film are real and
          credited.
        </p>
      )}
      {q && corrected && !exact && (
        <p className="serp-corrected">
          Showing results for <b>{corrected}</b>.{" "}
          <Link href={link({ exact: "1" })}>Search only for “{q}”</Link>
        </p>
      )}

      {type === "questions" && questions ? (
        <div className="serp-grid">
          <div className="serp-main">
            <nav className="serp-filters" aria-label="Show">
              {(
                [
                  ["open", "Waiting for an answer"],
                  ["answered", "Answered"],
                  ["all", "Every question"],
                ] as const
              ).map(([value, label]) => (
                <Link
                  key={value}
                  href={link({ show: value === "open" ? "" : value, page: "" })}
                  aria-current={show === value ? "true" : undefined}
                >
                  {label}
                </Link>
              ))}
              <span className="serp-filters-gap" aria-hidden="true" />
              <Link
                href={link({ where: "", page: "" })}
                aria-current={where === "everyone" ? "true" : undefined}
              >
                Everyone
              </Link>
              <Link
                href={link({ where: "mine", page: "" })}
                aria-current={where === "mine" ? "true" : undefined}
              >
                My communities
              </Link>
            </nav>
            {where === "mine" && !mine.length ? (
              <div className="empty-state">
                <h3>You haven’t joined a community yet.</h3>
                <p>Join one and its questions gather here.</p>
                <Link className="button button-dark" href="/communities">
                  Find a community
                </Link>
              </div>
            ) : questions.items.length ? (
              <QuestionList items={questions.items} />
            ) : (
              <div className="empty-state">
                <h3>
                  {show === "open"
                    ? "Every question here has a response."
                    : "No questions match."}
                </h3>
              </div>
            )}
            {questions.pages > 1 && (
              <nav className="you-pages" aria-label="Pages">
                {questions.page > 1 && (
                  <Link href={link({ page: String(questions.page - 1) })}>
                    Previous
                  </Link>
                )}
                <span>
                  Page {questions.page} of {questions.pages}
                </span>
                {questions.page < questions.pages && (
                  <Link href={link({ page: String(questions.page + 1) })}>
                    Next
                  </Link>
                )}
              </nav>
            )}
          </div>
          <aside className="serp-side">
            <AskCard
              q={q}
              found={questions.items.length > 0}
              suggested={suggested}
            />
          </aside>
        </div>
      ) : (
        <div className="serp-grid">
          <div className="serp-main">
            <h1 className="serp-count">
              {results.length
                ? `${results.length} ${results.length === 1 ? "result" : "results"}${q ? ` for “${corrected && !exact ? corrected : q}”` : ""}`
                : `Nothing found${q ? ` for “${q}”` : ""}`}
            </h1>
            {moments.length > 0 && (
              <section className="serp-moments" aria-labelledby="moments-title">
                <h2 id="moments-title">Moments in video</h2>
                <ul>
                  {moments.map(({ anchor, result }) => (
                    <li key={anchor.href}>
                      <Link href={anchor.href}>
                        <span className="serp-thumb">
                          {result.doc.picture && (
                            <img
                              src={result.doc.picture.small}
                              alt=""
                              loading="lazy"
                              width={result.doc.picture.width}
                              height={result.doc.picture.height}
                            />
                          )}
                          <span className="serp-time">
                            <Play size={11} /> {clock(anchor.at ?? 0)}
                          </span>
                        </span>
                        <strong>{anchor.text.split(". ")[0]}</strong>
                        <span>{result.doc.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {results.length ? (
              <ol className="serp-results">
                {results.map((result) => (
                  <ResultItem
                    key={result.doc.id}
                    result={result}
                    responses={answers.get(result.doc.id)?.responses}
                  />
                ))}
              </ol>
            ) : (
              <div className="serp-empty">
                <p>
                  Try fewer or different words, or one of these searches. Or ask
                  it, and people who’ve been there will see it.
                </p>
                <Suggest />
              </div>
            )}
          </div>
          <aside className="serp-side">
            <AskCard q={q} found={results.length > 0} suggested={suggested} />
            {summary.total > 0 && <Evidence summary={summary} />}
          </aside>
        </div>
      )}
    </div>
  );
}

/**
 * The second half of every search: if the answer isn't here, ask. The question
 * keeps the words already typed and goes to the community most likely to know.
 */
function AskCard({
  q,
  found,
  suggested,
}: {
  q: string;
  found: boolean;
  suggested: Community[];
}) {
  return (
    <section className="ask-card" aria-labelledby="ask-card-title">
      <h2 id="ask-card-title">
        {!q
          ? "Stuck on something yourself?"
          : found
            ? "Didn’t find your answer?"
            : "Nobody has posted this yet."}
      </h2>
      <p>
        Ask it. People who’ve been stuck on the same thing will see it and help.
      </p>
      <form action="/new">
        <input type="hidden" name="kind" value="problem" />
        <label className="sr-only" htmlFor="ask-card-q">
          Your question
        </label>
        <textarea
          id="ask-card-q"
          name="q"
          rows={2}
          maxLength={160}
          defaultValue={q}
          placeholder="What are you stuck on?"
        />
        {suggested.length > 0 && (
          <label className="ask-card-where">
            <span>Ask in</span>
            <select name="community" defaultValue={suggested[0].slug}>
              {suggested.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
              <option value="">Everyone</option>
            </select>
          </label>
        )}
        <button className="button button-dark">Ask the question</button>
      </form>
    </section>
  );
}

function Evidence({ summary }: { summary: ReturnType<typeof summarize> }) {
  return (
    <section className="evidence" aria-labelledby="evidence-title">
      <h2 id="evidence-title">What the attempts say</h2>
      <p className="evidence-sub">
        Counted from {summary.total}{" "}
        {summary.total === 1 ? "matching entry" : "matching entries"}.
      </p>
      <div className="evidence-bar" aria-hidden="true">
        {summary.outcomes.map((o) => (
          <span
            key={o.key}
            data-outcome={o.key}
            style={{ flexGrow: o.count }}
          />
        ))}
        {summary.open > 0 && (
          <span data-outcome="open" style={{ flexGrow: summary.open }} />
        )}
      </div>
      <ul className="evidence-counts">
        {summary.outcomes.map((o) => (
          <li key={o.key} data-outcome={o.key}>
            <OutcomeGlyph outcome={o.key} /> {o.label}
            <b>{o.count}</b>
          </li>
        ))}
        {summary.open > 0 && (
          <li data-outcome="open">
            <OutcomeGlyph outcome="open" /> No result yet
            <b>{summary.open}</b>
          </li>
        )}
      </ul>
      {summary.breaks.length > 0 && (
        <>
          <h3>Where it broke</h3>
          <ul className="evidence-list">
            {summary.breaks.map(({ moment, doc }) => (
              <li key={doc.id + moment.at}>
                <Link href={`${doc.href}?t=${Math.floor(moment.at)}#clip`}>
                  <span className="moment-time">{clock(moment.at)}</span>
                  {moment.label}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {summary.explanations.length > 0 && (
        <>
          <h3>Explanations on record</h3>
          <ul className="evidence-list">
            {summary.explanations.map((e) => (
              <li key={e.doc.id + e.label} data-state={e.state}>
                <Link href={`${e.doc.href}?discuss=1`}>
                  <span className="evidence-state">
                    <span className="evidence-dot" aria-hidden="true" />
                    {e.state}
                  </span>
                  {e.label}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
function ResultItem({
  result,
  responses,
}: {
  result: Result;
  responses?: number;
}) {
  const { doc } = result;
  const outcome = doc.source === "entry" ? (doc.outcome ?? "open") : null;
  return (
    <li className="result" data-outcome={outcome ?? undefined}>
      <div className="result-body">
        <p className="result-crumb">
          {outcome && <OutcomeGlyph outcome={outcome as never} size={12} />}
          {doc.field} › {doc.kindLabel} · {doc.place}
        </p>
        <h2>
          <Link href={doc.href}>{doc.title}</Link>
        </h2>
        <p className="result-snippet">
          {result.snippet.map((segment, i) =>
            segment.hit ? <mark key={i}>{segment.text}</mark> : segment.text,
          )}
        </p>
        {result.matched.length > 0 && (
          <ul className="result-anchors" aria-label="Matched in">
            {result.matched.map((anchor) => (
              <li key={anchor.href + anchor.label}>
                <Link href={anchor.href} data-anchor={anchor.kind}>
                  {anchor.kind === "moment" && (
                    <Play size={11} aria-hidden="true" />
                  )}
                  <b>{anchor.label}</b>
                  <span>
                    {anchor.text.slice(0, 70)}
                    {anchor.text.length > 70 ? "…" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="result-stats">
          {doc.types.has("questions") ? (
            <>
              <span className="result-open">
                {responses
                  ? `${responses} ${responses === 1 ? "response" : "responses"}`
                  : "No answers yet"}
              </span>
              <Link href={`${doc.href}?discuss=1`}>
                {responses ? "Join in" : "Answer it"}
              </Link>
            </>
          ) : doc.source === "entry" ? (
            `${doc.tried} tried · ${doc.helped} found it useful`
          ) : (
            `${doc.helped} notes in this session`
          )}
        </p>
      </div>
      {doc.picture && (
        <Link
          className="result-thumb"
          href={doc.href}
          tabIndex={-1}
          aria-hidden="true"
        >
          <img
            src={doc.picture.small}
            alt=""
            loading="lazy"
            width={doc.picture.width}
            height={doc.picture.height}
          />
          {doc.duration && (
            <span className="serp-time">
              <Play size={11} /> {clock(doc.duration)}
            </span>
          )}
        </Link>
      )}
    </li>
  );
}
function Suggest() {
  return (
    <ul className="suggest">
      {suggestions.map((s) => (
        <li key={s}>
          <Link href={`/search?q=${encodeURIComponent(s)}`}>{s}</Link>
        </li>
      ))}
    </ul>
  );
}
