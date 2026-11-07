import type { Metadata } from "next";
import Link from "next/link";
import { AskBar, QuestionList } from "@/components/question-list";
import { currentAccount } from "@/lib/auth.server";
import { joinedSlugs, listCommunities } from "@/lib/communities.server";
import { topics } from "@/lib/data";
import { hasDatabase } from "@/lib/db.server";
import { questionItems, type Show } from "@/lib/questions.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Questions" };
const number = (n: number) => n.toLocaleString("en");

/**
 * Everyone's open problems, waiting for someone who has been there. Your own
 * posts and saved notes live in the notebook instead.
 */
export default async function Questions({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const show: Show =
    params.show === "all" || params.show === "answered" ? params.show : "open";
  const where = params.where === "mine" ? "mine" : "everyone";
  const field = topics.find((t) => t === params.field) ?? "";
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const page = Math.max(1, Number(params.page) || 1);
  const account = hasDatabase() ? await currentAccount() : undefined;
  const mine = await joinedSlugs(account);
  const [result, all] = await Promise.all([
    questionItems({
      communities: where === "mine" ? mine : undefined,
      show,
      field,
      q,
      page,
    }),
    listCommunities(),
  ]);
  const link = (change: Record<string, string>) => {
    const next = new URLSearchParams({
      ...(show !== "open" ? { show } : {}),
      ...(where !== "everyone" ? { where } : {}),
      ...(field ? { field } : {}),
      ...(q ? { q } : {}),
      ...change,
    });
    [...next.entries()].forEach(([k, v]) => !v && next.delete(k));
    return `/questions${next.size ? `?${next}` : ""}`;
  };
  return (
    <div className="frame questions">
      <header className="section-hero">
        <p className="label">Questions</p>
        <h1>
          Someone is stuck. <span className="tint-brand">You might know.</span>
        </h1>
        <p className="page-lede">
          Open problems from everyone, newest activity first. Answer one, or ask
          your own. Your posts and saved notes are in{" "}
          <Link className="text-link" href="/notebook">
            your notebook
          </Link>
          .
        </p>
        <AskBar />
      </header>

      <div className="q-layout">
        <aside className="q-filters" aria-label="Filter questions">
          <p className="label">Show</p>
          <nav>
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
          </nav>
          <p className="label">From</p>
          <nav>
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
            {mine.slice(0, 6).map((slug) => {
              const c = all.find((x) => x.slug === slug);
              return c ? (
                <Link
                  key={slug}
                  href={`/communities/${slug}`}
                  className="q-sub"
                >
                  {c.name}
                </Link>
              ) : null;
            })}
          </nav>
          <p className="label">Field</p>
          <nav>
            <Link
              href={link({ field: "", page: "" })}
              aria-current={!field ? "true" : undefined}
            >
              Every field
            </Link>
            {topics.map((t) => (
              <Link
                key={t}
                href={link({ field: t, page: "" })}
                aria-current={field === t ? "true" : undefined}
              >
                {t}
              </Link>
            ))}
          </nav>
        </aside>
        <section className="q-results" aria-labelledby="q-results-title">
          <div className="q-results-head">
            <h2 id="q-results-title">
              {number(result.total)}{" "}
              {show === "open"
                ? result.total === 1
                  ? "question waiting"
                  : "questions waiting"
                : result.total === 1
                  ? "question"
                  : "questions"}
            </h2>
            <form action="/questions" className="community-search">
              {Object.entries({ show, where, field }).map(([k, v]) =>
                v && v !== "open" && v !== "everyone" ? (
                  <input key={k} type="hidden" name={k} value={v} />
                ) : null,
              )}
              <input
                type="search"
                name="q"
                defaultValue={q}
                aria-label="Search questions"
                placeholder="Search questions"
              />
            </form>
          </div>
          {where === "mine" && !mine.length ? (
            <div className="empty-state">
              <h3>You haven’t joined a community yet.</h3>
              <p>Join one and its questions will gather here.</p>
              <Link className="button button-dark" href="/communities">
                Find a community
              </Link>
            </div>
          ) : result.items.length ? (
            <QuestionList items={result.items} />
          ) : (
            <div className="empty-state">
              <h3>
                {show === "open"
                  ? "Every question here has a response."
                  : "No questions match."}
              </h3>
              <p>Try another field, or ask the first one.</p>
            </div>
          )}
          {result.pages > 1 && (
            <nav className="you-pages" aria-label="Pages">
              {result.page > 1 && (
                <Link href={link({ page: String(result.page - 1) })}>
                  Previous
                </Link>
              )}
              <span>
                Page {result.page} of {result.pages}
              </span>
              {result.page < result.pages && (
                <Link href={link({ page: String(result.page + 1) })}>Next</Link>
              )}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
