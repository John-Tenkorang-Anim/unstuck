import Link from "next/link";
import { myPosts } from "@/lib/discussion.server";
import { statusLabels, type SessionStatus } from "@/lib/sessions";
import type { Account } from "@/lib/store.server";

const number = (n: number) => n.toLocaleString("en");
/** Everything someone posted, ordered by where something new happened. */
export async function MyPosts({
  account,
  filter,
  page,
  link,
}: {
  account: Account;
  filter: "all" | "attention";
  page: number;
  link: (page: number) => string;
}) {
  const posts = await myPosts(account, { page, filter });
  return (
    <>
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
                    {post.kind === "session"
                      ? "Critique"
                      : post.entry_kind === "problem"
                        ? "Question"
                        : "Field note"}
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
          {page > 1 && <Link href={link(page - 1)}>Previous</Link>}
          <span>
            Page {page} of {posts.pages} · {number(posts.total)} posts
          </span>
          {page < posts.pages && <Link href={link(page + 1)}>Next</Link>}
        </nav>
      )}
    </>
  );
}
