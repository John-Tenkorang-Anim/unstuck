import type { Metadata } from "next";
import Link from "next/link";
import { currentAccount } from "@/lib/auth.server";
import { hasDatabase } from "@/lib/db.server";
import { myPosts } from "@/lib/discussion.server";
import { statusLabels, type SessionStatus } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your posts" };

const number = (n: number) => n.toLocaleString("en");
/** Everything you've posted, ordered by where something new happened. */
export default async function YourPosts({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const account = hasDatabase() ? await currentAccount() : undefined;
  if (!account)
    return (
      <div className="frame account-page">
        <div className="empty-state">
          <h3>Sign in to see your posts.</h3>
          <p>
            <Link className="text-link" href="/account">
              Choose a name or use your recovery code
            </Link>
          </p>
        </div>
      </div>
    );
  const params = await searchParams;
  const filter = params.show === "attention" ? "attention" : "all";
  const page = Math.max(1, Number(params.page) || 1);
  const posts = await myPosts(account, { page, filter });
  const link = (change: Record<string, string>) => {
    const next = new URLSearchParams({
      ...(filter !== "all" ? { show: filter } : {}),
      ...change,
    });
    return `/you${next.size ? `?${next}` : ""}`;
  };
  return (
    <div className="frame you">
      <header className="page-bar">
        <div>
          <h1>Your posts</h1>
          <p>
            What people said, what’s new since you last looked, and questions
            waiting for you.
          </p>
        </div>
        <Link className="button button-dark" href="/new">
          New note
        </Link>
      </header>
      <nav className="serp-fields" aria-label="Show">
        <Link href="/you" aria-current={filter === "all" ? "true" : undefined}>
          Everything
        </Link>
        <Link
          href="/you?show=attention"
          aria-current={filter === "attention" ? "true" : undefined}
        >
          Needs your attention
        </Link>
      </nav>
      {posts.items.length ? (
        <table className="you-table">
          <thead>
            <tr>
              <th scope="col">Post</th>
              <th scope="col" className="num">
                Responses
              </th>
              <th scope="col" className="num">
                New
              </th>
              <th scope="col" className="num">
                Unanswered
              </th>
              <th scope="col">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {posts.items.map((post) => (
              <tr key={post.kind + post.id}>
                <td>
                  <Link
                    href={
                      post.kind === "entry"
                        ? `/entries/${post.id}`
                        : `/sessions/${post.id}`
                    }
                    className="you-title"
                  >
                    {post.title}
                  </Link>
                  <span className="you-meta">
                    {post.kind === "entry" ? "Field note" : "Critique"}
                    {post.status
                      ? ` · ${statusLabels[post.status as SessionStatus]}`
                      : ""}
                    {post.hidden ? " · Hidden" : ""}
                  </span>
                </td>
                <td className="num">{number(post.responses)}</td>
                <td className="num">
                  {post.fresh ? (
                    <span className="you-new">{number(post.fresh)}</span>
                  ) : (
                    "–"
                  )}
                </td>
                <td className="num">
                  {post.unanswered ? number(post.unanswered) : "–"}
                </td>
                <td className="you-date">
                  {(post.latest ?? post.created).toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="empty-state">
          <h3>
            {filter === "attention"
              ? "Nothing needs you right now."
              : "You haven’t posted yet."}
          </h3>
          <p>
            {filter === "attention"
              ? "New responses and unanswered questions will show up here."
              : "Share an attempt, or ask for critique on your work."}
          </p>
        </div>
      )}
      {posts.pages > 1 && (
        <nav className="you-pages" aria-label="Pages">
          {page > 1 && (
            <Link href={link({ page: String(page - 1) })}>Previous</Link>
          )}
          <span>
            Page {page} of {posts.pages} · {number(posts.total)} posts
          </span>
          {page < posts.pages && (
            <Link href={link({ page: String(page + 1) })}>Next</Link>
          )}
        </nav>
      )}
    </div>
  );
}
