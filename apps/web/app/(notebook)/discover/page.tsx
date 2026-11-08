import Link from "next/link";
import { ArrowRight, MessageCircleQuestion, Search } from "lucide-react";
import { FeedRow } from "@/components/feed-row";
import { getNotebook } from "@/lib/api";
import { currentAccount } from "@/lib/auth.server";
import { isQuestion, spectralClass } from "@/lib/communities";
import { communityStats, listCommunities } from "@/lib/communities.server";
import { topics } from "@/lib/data";
import { hasDatabase } from "@/lib/db.server";
import { responseCounts } from "@/lib/discussion.server";

export const dynamic = "force-dynamic";
const views = [
  ["new", "New"],
  ["tried", "Most tried"],
  ["unanswered", "Unanswered"],
] as const;
type View = (typeof views)[number][0];
const pageSize = 12;
const number = (n: number) => n.toLocaleString("en");

/**
 * Discover does one job: show what people are getting stuck on, newest first,
 * with search and ask at the top. Everything renders on the server, and the
 * tabs and field menu are plain links, so it works before scripts load.
 */
export default async function Discover({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view: View = views.find(([key]) => key === params.view)?.[0] ?? "new";
  const field = topics.find((t) => t === params.topic) ?? "";
  const shown = Math.max(1, Number(params.more) || 1) * pageSize;
  const account = hasDatabase() ? await currentAccount() : undefined;
  const [notebook, communities] = await Promise.all([
    getNotebook(),
    listCommunities().catch(() => []),
  ]);
  const counts = await responseCounts(notebook.entries.map((e) => e.id));
  const responses = (id: string, fallback: number) =>
    Math.max(counts.get(id)?.responses ?? 0, fallback);
  const inField = notebook.entries.filter((e) => !field || e.topic === field);
  const feed = (
    view === "unanswered"
      ? inField.filter(
          (e) => isQuestion(e.kind) && !(counts.get(e.id)?.responses ?? 0),
        )
      : inField
  ).sort((a, b) =>
    view === "tried" ? b.tried - a.tried : b.date.localeCompare(a.date),
  );
  const stats = await communityStats(
    communities.map((c) => c.slug),
    account,
  ).catch(() => ({}) as Awaited<ReturnType<typeof communityStats>>);
  const rail = [...communities]
    .sort(
      (a, b) =>
        Number(stats[b.slug]?.joined) - Number(stats[a.slug]?.joined) ||
        (stats[b.slug]?.unanswered ?? 0) - (stats[a.slug]?.unanswered ?? 0),
    )
    .slice(0, 4);
  const link = (change: Record<string, string>) => {
    const next = new URLSearchParams({
      ...(view !== "new" ? { view } : {}),
      ...(field ? { topic: field } : {}),
      ...change,
    });
    for (const [key, value] of [...next]) if (!value) next.delete(key);
    return `/discover${next.size ? `?${next}` : ""}#feed`;
  };
  return (
    <div className="discover frame">
      <section className="discover-hero" aria-labelledby="hero-title">
        <h1 id="hero-title">
          Learn from <span className="tint-brand">what failed.</span>
        </h1>
        <p>
          See what people tried, what broke and what worked. Search for your
          problem, or ask it.
        </p>
        <form className="home-bar" action="/search" role="search">
          <Search size={20} aria-hidden="true" />
          <input
            type="search"
            name="q"
            aria-label="Search, or describe your problem"
            placeholder="What are you trying to figure out?"
            autoComplete="off"
          />
          <button
            className="button button-outline home-ask"
            formAction="/new"
            name="kind"
            value="problem"
          >
            Ask
          </button>
          <button className="button button-dark">Search</button>
        </form>
      </section>

      <div className="discover-body">
        <section id="feed" className="feed" aria-labelledby="feed-title">
          <h2 id="feed-title" className="sr-only">
            What people tried
          </h2>
          <div className="feed-bar">
            <nav className="feed-tabs" aria-label="Show">
              {views.map(([key, label]) => (
                <Link
                  key={key}
                  href={link({ view: key === "new" ? "" : key, more: "" })}
                  aria-current={view === key ? "page" : undefined}
                >
                  {label}
                </Link>
              ))}
            </nav>
            <details className="feed-field">
              <summary>{field || "All fields"}</summary>
              <div className="feed-field-menu">
                {["", ...topics].map((t) => (
                  <Link
                    key={t}
                    href={link({ topic: t, more: "" })}
                    aria-current={t === field ? "true" : undefined}
                  >
                    {t || "All fields"}
                  </Link>
                ))}
              </div>
            </details>
          </div>
          {notebook.mode === "examples" && (
            <p className="example-notice">
              <span className="example-tag">Sample data</span> Fictional stories
              and one historical case. Photos and film are real.
            </p>
          )}
          {notebook.mode === "unavailable" ? (
            <div className="empty-state">
              <h3>The notebook is taking a moment.</h3>
              <p>We couldn’t reach it. Please try again shortly.</p>
            </div>
          ) : feed.length ? (
            <div className="feed-list">
              {feed.slice(0, shown).map((entry) => (
                <FeedRow
                  key={entry.id}
                  entry={entry}
                  responses={responses(entry.id, entry.comments)}
                  community={communities.find(
                    (c) => c.slug === entry.communities?.[0],
                  )}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>
                {view === "unanswered"
                  ? "Every question here has a response."
                  : "Nothing here yet."}
              </h3>
              <p>Try another field, or share what you tried.</p>
            </div>
          )}
          {feed.length > shown && (
            <Link
              className="button button-outline feed-more"
              href={link({ more: String(shown / pageSize + 1) })}
            >
              Show more
            </Link>
          )}
        </section>

        <aside className="discover-rail" aria-label="Get help">
          <section className="rail-ask" aria-labelledby="rail-ask-title">
            <MessageCircleQuestion size={20} aria-hidden="true" />
            <h2 id="rail-ask-title">Stuck on something?</h2>
            <p>
              Search first. Someone may have been there. If not, ask, and the
              people who know the field will see it.
            </p>
            <Link className="button button-dark" href="/new?kind=problem">
              Ask a question
            </Link>
            <Link className="rail-link" href="/sessions/new">
              Or get feedback on a piece of work <ArrowRight size={13} />
            </Link>
          </section>
          {rail.length > 0 && (
            <section
              className="rail-communities"
              aria-labelledby="rail-c-title"
            >
              <h2 id="rail-c-title">Communities</h2>
              <ul>
                {rail.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/communities/${c.slug}`}>
                      <span
                        className="community-mark"
                        data-class={spectralClass(c.slug)}
                        aria-hidden="true"
                      >
                        {c.name.slice(0, 1)}
                      </span>
                      <span>
                        <strong>{c.name}</strong>
                        <small>
                          {stats[c.slug]?.joined
                            ? "Joined"
                            : `${number(stats[c.slug]?.unanswered ?? 0)} waiting for an answer`}
                        </small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link className="rail-link" href="/communities">
                All communities <ArrowRight size={13} />
              </Link>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
