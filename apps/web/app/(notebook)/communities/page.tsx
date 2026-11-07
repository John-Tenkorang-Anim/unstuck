import { spectralClass } from "@/lib/communities";
import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { CreateCommunity, JoinButton } from "@/components/community-actions";
import { currentAccount } from "@/lib/auth.server";
import { communityStats, listCommunities } from "@/lib/communities.server";
import { topics } from "@/lib/data";
import { hasDatabase } from "@/lib/db.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Communities" };
const number = (n: number) => n.toLocaleString("en");

export default async function Communities({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const field = topics.find((t) => t === params.field) ?? "";
  const account = hasDatabase() ? await currentAccount() : undefined;
  const all = await listCommunities();
  const stats = await communityStats(
    all.map((c) => c.slug),
    account,
  );
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = all.filter(
    (c) =>
      (!field || c.topic === field) &&
      terms.every((t) => `${c.name} ${c.about}`.toLowerCase().includes(t)),
  );
  const yours = all.filter((c) => stats[c.slug]?.joined);
  const link = (change: Record<string, string>) => {
    const next = new URLSearchParams({
      ...(q ? { q } : {}),
      ...(field ? { field } : {}),
      ...change,
    });
    [...next.entries()].forEach(([k, v]) => !v && next.delete(k));
    return `/communities${next.size ? `?${next}` : ""}`;
  };
  return (
    <div className="frame communities">
      <header className="section-hero">
        <p className="label">Communities</p>
        <h1>
          Find the people who’ve{" "}
          <span className="tint-accent">been there.</span>
        </h1>
        <p className="page-lede">
          Open groups around one kind of problem. Anyone can read, join and
          post, and each one keeps a library of what its members tried.
        </p>
        <form className="home-bar section-search" action="/communities">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            aria-label="Search communities"
            placeholder="Search communities"
          />
          {field && <input type="hidden" name="field" value={field} />}
          <button className="button button-dark">Search</button>
        </form>
      </header>

      {yours.length > 0 && !q && !field && (
        <section className="yours" aria-labelledby="yours-title">
          <h2 id="yours-title" className="section-title">
            Yours
          </h2>
          <ul className="yours-row">
            {yours.map((c) => (
              <li key={c.slug}>
                <Link href={`/communities/${c.slug}`}>
                  <strong>{c.name}</strong>
                  <span>
                    {stats[c.slug].unanswered
                      ? `${number(stats[c.slug].unanswered)} waiting for an answer`
                      : "No unanswered questions"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav className="serp-fields" aria-label="Fields">
        <Link
          href={link({ field: "" })}
          aria-current={!field ? "true" : undefined}
        >
          Every field
        </Link>
        {topics.map((t) => (
          <Link
            key={t}
            href={link({ field: t })}
            aria-current={field === t ? "true" : undefined}
          >
            {t}
          </Link>
        ))}
      </nav>

      {shown.length ? (
        <ul className="community-grid">
          {shown.map((c) => {
            const s = stats[c.slug];
            return (
              <li key={c.slug} className="community-card">
                <div className="community-card-top">
                  <span
                    className="community-mark"
                    data-class={spectralClass(c.slug)}
                    aria-hidden="true"
                  >
                    {c.name.slice(0, 1)}
                  </span>
                  <JoinButton
                    community={c}
                    joined={s.joined}
                    members={s.members}
                    enabled={hasDatabase()}
                    compact
                  />
                </div>
                <h3>
                  <Link href={`/communities/${c.slug}`} className="tile-link">
                    {c.name}
                  </Link>
                </h3>
                <p>{c.about}</p>
                <dl className="community-stats">
                  <div>
                    <dt>Members</dt>
                    <dd>{number(s.members)}</dd>
                  </div>
                  <div>
                    <dt>Waiting</dt>
                    <dd>{number(s.unanswered)}</dd>
                  </div>
                  <div>
                    <dt>In the library</dt>
                    <dd>{number(s.library)}</dd>
                  </div>
                </dl>
                <span className="community-field">
                  {c.topic}
                  {c.sample ? " · Sample" : ""}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="empty-state">
          <h3>No community matches that yet.</h3>
          <p>Start one below, and the next person searching will find it.</p>
        </div>
      )}

      <section className="start-community" aria-labelledby="start-title">
        <div>
          <h2 id="start-title">Start a community</h2>
          <p>
            Give a recurring kind of problem a home. Members get its questions
            first, and what they learn builds its library.
          </p>
        </div>
        <CreateCommunity enabled={hasDatabase()} />
      </section>
    </div>
  );
}
