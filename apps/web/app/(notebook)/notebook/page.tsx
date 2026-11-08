export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Discovery } from "@/components/discovery";
import { MyPosts } from "@/components/my-posts";
import { getNotebook } from "@/lib/api";
import { currentAccount } from "@/lib/auth.server";
import { communityStats, myCommunities } from "@/lib/communities.server";
import { hasDatabase } from "@/lib/db.server";
import { repliesToMe } from "@/lib/discussion.server";
import { myCritiques } from "@/lib/critique.server";

export const metadata: Metadata = { title: "Your notebook" };
const number = (n: number) => n.toLocaleString("en");
type Tab = "posts" | "critiques" | "saved" | "communities";

/**
 * Everything that is yours: what you posted, what you saved, your draft and
 * your critiques and your communities. Other people's problems are found
 * from Discover.
 */
export default async function Notebook({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const account = hasDatabase() ? await currentAccount() : undefined;
  const tab: Tab =
    params.tab === "saved" ||
    params.tab === "communities" ||
    params.tab === "critiques"
      ? params.tab
      : params.tab === "posts" || account
        ? "posts"
        : "saved";
  const filter = params.show === "attention" ? "attention" : "all";
  const page = Math.max(1, Number(params.page) || 1);
  const joined = tab === "communities" ? await myCommunities(account) : [];
  const replies = tab === "posts" && account ? await repliesToMe(account) : [];
  const critiques =
    tab === "critiques" && account ? await myCritiques(account) : undefined;
  const stats = joined.length
    ? await communityStats(
        joined.map((c) => c.slug),
        account,
      )
    : {};
  const tabs: [Tab, string][] = [
    ["posts", "Your posts"],
    ["critiques", "Critiques"],
    ["saved", "Saved"],
    ["communities", "Your communities"],
  ];
  return (
    <div className="frame notebook">
      <header className="section-hero section-hero-tight">
        <p className="label">Notebook</p>
        <h1>
          Everything that’s <span className="tint-brand">yours.</span>
        </h1>
        <p className="page-lede">
          What you asked, shared, critiqued and saved.
        </p>
      </header>
      <nav className="community-tabs" aria-label="In your notebook">
        {tabs.map(([value, label]) => (
          <Link
            key={value}
            href={`/notebook?tab=${value}`}
            aria-current={tab === value ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
        <Link className="notebook-draft" href="/new">
          Your draft <ArrowUpRight size={14} />
        </Link>
      </nav>

      {tab === "posts" &&
        (account ? (
          <section className="you" aria-label="Your posts">
            {replies.length > 0 && filter === "all" && page === 1 && (
              <section className="replies-to-you" aria-labelledby="rty-title">
                <h2 id="rty-title" className="section-title">
                  Replies to you
                  {replies.some((r) => r.fresh) && (
                    <span className="you-new">
                      {replies.filter((r) => r.fresh).length} new
                    </span>
                  )}
                </h2>
                <ul>
                  {replies.slice(0, 6).map((r) => (
                    <li key={r.id} data-fresh={r.fresh || undefined}>
                      <Link
                        href={`/entries/${r.entryId}?discuss=1#comment-${r.parentId}`}
                      >
                        <span className="rty-meta">
                          <b>{r.author}</b> replied on {r.entryTitle}
                        </span>
                        <span className="rty-body">{r.body}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <nav className="serp-fields" aria-label="Show">
              <Link
                href="/notebook?tab=posts"
                aria-current={filter === "all" ? "true" : undefined}
              >
                Everything
              </Link>
              <Link
                href="/notebook?tab=posts&show=attention"
                aria-current={filter === "attention" ? "true" : undefined}
              >
                Needs your attention
              </Link>
            </nav>
            <MyPosts
              account={account}
              filter={filter}
              page={page}
              link={(n) =>
                `/notebook?tab=posts${filter === "attention" ? "&show=attention" : ""}&page=${n}`
              }
            />
          </section>
        ) : (
          <div className="empty-state">
            <h3>Sign in to see what you’ve posted.</h3>
            <p>
              Your posts follow your name across devices.{" "}
              <Link className="text-link" href="/account">
                Choose a name or use your recovery code
              </Link>
            </p>
          </div>
        ))}

      {tab === "saved" && (
        <Discovery notebook={await getNotebook()} savedOnly embedded />
      )}

      {tab === "critiques" &&
        (account && critiques ? (
          <div className="critiques">
            <section aria-labelledby="given-title">
              <div className="critiques-head">
                <h2 id="given-title" className="section-title">
                  Feedback you gave
                </h2>
                <Link className="text-link" href="/sessions">
                  Find work to critique
                </Link>
              </div>
              {critiques.given.length ? (
                <ul className="critique-list">
                  {critiques.given.map((n) => (
                    <li key={n.id}>
                      <Link href={`/sessions/${n.sessionId}#note-${n.id}`}>
                        <span className="critique-meta">
                          On <b>{n.title}</b>
                          {n.resolved && (
                            <span className="critique-done">
                              Marked as resolved
                            </span>
                          )}
                        </span>
                        <span className="critique-body">{n.body}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="quiet-notice">
                  Feedback you leave on someone’s work will collect here.
                </p>
              )}
            </section>
            <section aria-labelledby="shared-title">
              <div className="critiques-head">
                <h2 id="shared-title" className="section-title">
                  Your work up for critique
                </h2>
                <Link className="text-link" href="/sessions/new">
                  Share a piece of work
                </Link>
              </div>
              {critiques.shared.length ? (
                <ul className="critique-list">
                  {critiques.shared.map((s) => (
                    <li key={s.id}>
                      <Link href={`/sessions/${s.id}`}>
                        <span className="critique-meta">
                          {s.statusLabel} · {number(s.notes)}{" "}
                          {s.notes === 1 ? "note" : "notes"}
                          {s.open > 0 && (
                            <span className="you-new">
                              {number(s.open)} open
                            </span>
                          )}
                        </span>
                        <span className="critique-title">{s.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="quiet-notice">
                  Share a photo, PDF, video or your working and people will pin
                  feedback on it.
                </p>
              )}
            </section>
          </div>
        ) : (
          <div className="empty-state">
            <h3>Sign in to see your critiques.</h3>
            <p>
              <Link className="text-link" href="/account">
                Choose a name or use your recovery code
              </Link>
            </p>
          </div>
        ))}

      {tab === "communities" &&
        (joined.length ? (
          <ul className="yours-row yours-grid">
            {joined.map((c) => (
              <li key={c.slug}>
                <Link href={`/communities/${c.slug}`}>
                  <strong>{c.name}</strong>
                  <span>
                    {number(stats[c.slug]?.unanswered ?? 0)} waiting ·{" "}
                    {number(stats[c.slug]?.library ?? 0)} in the library
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <h3>You haven’t joined a community yet.</h3>
            <p>Communities bring the questions you can help with to you.</p>
            <Link className="button button-dark" href="/communities">
              Find a community
            </Link>
          </div>
        ))}
    </div>
  );
}
