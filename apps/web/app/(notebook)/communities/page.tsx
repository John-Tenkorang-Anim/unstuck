import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { CreateCommunity, JoinButton } from "@/components/community-actions";
import { currentAccount } from "@/lib/auth.server";
import { spectralClass } from "@/lib/communities";
import {
  communityStats,
  myCommunities,
  searchCommunities,
  type CommunitySort,
} from "@/lib/communities.server";
import { topics } from "@/lib/data";
import { hasDatabase } from "@/lib/db.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Communities" };
const number = (n: number) => n.toLocaleString("en");
const sorts: [CommunitySort, string][] = [
  ["members", "Most members"],
  ["newest", "Newest"],
  ["name", "A–Z"],
];

/**
 * A directory that stays usable with thousands of communities: one line each,
 * searched, filtered and sorted in the database, thirty to a page. The ones
 * you joined sit above it.
 */
export default async function Communities({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const field = topics.find((t) => t === params.field) ?? "";
  const sort = sorts.find(([key]) => key === params.sort)?.[0] ?? "members";
  const page = Math.max(1, Number(params.page) || 1);
  const account = hasDatabase() ? await currentAccount() : undefined;
  const [found, yours] = await Promise.all([
    searchCommunities({ q, field, sort, page }),
    myCommunities(account),
  ]);
  const stats = await communityStats(
    [...new Set([...found.items, ...yours].map((c) => c.slug))],
    account,
  );
  const link = (change: Record<string, string>) => {
    const next = new URLSearchParams({
      ...(q ? { q } : {}),
      ...(field ? { field } : {}),
      ...(sort !== "members" ? { sort } : {}),
      ...change,
    });
    for (const [key, value] of [...next]) if (!value) next.delete(key);
    return `/communities${next.size ? `?${next}` : ""}`;
  };
  return (
    <div className="frame communities">
      <header className="dir-head">
        <div>
          <h1>Communities</h1>
          <p>Open groups around one kind of problem. Anyone can join.</p>
        </div>
        <a className="button button-outline" href="#start">
          <Plus size={15} aria-hidden="true" /> Start one
        </a>
      </header>

      {yours.length > 0 && !q && !field && page === 1 && (
        <section className="dir-yours" aria-labelledby="yours-title">
          <h2 id="yours-title">Yours</h2>
          <ul>
            {yours.map((c) => (
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
                      {stats[c.slug]?.unanswered
                        ? `${number(stats[c.slug].unanswered)} waiting`
                        : "All answered"}
                    </small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="dir-tools">
        <form className="dir-search" action="/communities" role="search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            aria-label="Search communities"
            placeholder="Search communities"
          />
          {field && <input type="hidden" name="field" value={field} />}
          {sort !== "members" && (
            <input type="hidden" name="sort" value={sort} />
          )}
        </form>
        <details className="pick">
          <summary>{field || "All fields"}</summary>
          <div className="pick-menu">
            {["", ...topics].map((t) => (
              <Link
                key={t}
                href={link({ field: t, page: "" })}
                aria-current={t === field ? "true" : undefined}
              >
                {t || "All fields"}
              </Link>
            ))}
          </div>
        </details>
        <nav className="dir-sort" aria-label="Sort">
          {sorts.map(([key, label]) => (
            <Link
              key={key}
              href={link({ sort: key === "members" ? "" : key, page: "" })}
              aria-current={sort === key ? "true" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <p className="dir-count" role="status">
        {found.total
          ? `${number(found.total)} ${found.total === 1 ? "community" : "communities"}${q ? ` matching “${q}”` : ""}`
          : `No community matches${q ? ` “${q}”` : ""} yet.`}
      </p>

      {found.items.length > 0 && (
        <ol className="dir-list">
          {found.items.map((c) => {
            const s = stats[c.slug];
            return (
              <li key={c.slug} className="dir-row">
                <span
                  className="community-mark"
                  data-class={spectralClass(c.slug)}
                  aria-hidden="true"
                >
                  {c.name.slice(0, 1)}
                </span>
                <div className="dir-main">
                  <h3>
                    <Link className="dir-link" href={`/communities/${c.slug}`}>
                      {c.name}
                    </Link>
                  </h3>
                  <p>{c.about}</p>
                  <p className="dir-meta">
                    <span>{c.topic}</span>
                    <span>
                      {number(c.members)}{" "}
                      {c.members === 1 ? "member" : "members"}
                    </span>
                    {s?.unanswered ? (
                      <span className="dir-waiting">
                        {number(s.unanswered)} waiting
                      </span>
                    ) : null}
                    {s?.library ? (
                      <span>{number(s.library)} in the library</span>
                    ) : null}
                    {c.sample && <span>Sample</span>}
                  </p>
                </div>
                <JoinButton
                  community={c}
                  joined={!!s?.joined}
                  members={c.members}
                  enabled={hasDatabase()}
                  compact
                />
              </li>
            );
          })}
        </ol>
      )}

      {found.pages > 1 && (
        <nav className="you-pages" aria-label="Pages">
          {page > 1 && (
            <Link href={link({ page: String(page - 1) })}>Previous</Link>
          )}
          <span>
            Page {page} of {number(found.pages)}
          </span>
          {page < found.pages && (
            <Link href={link({ page: String(page + 1) })}>Next</Link>
          )}
        </nav>
      )}

      <section
        id="start"
        className="start-community"
        aria-labelledby="start-title"
      >
        <div>
          <h2 id="start-title">Start a community</h2>
          <p>
            Give a recurring kind of problem a home. Members see its questions
            first, and what they learn builds its library.
          </p>
        </div>
        <CreateCommunity enabled={hasDatabase()} />
      </section>
    </div>
  );
}
