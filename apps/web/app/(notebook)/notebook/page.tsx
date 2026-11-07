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

export const metadata: Metadata = { title: "Your notebook" };
const number = (n: number) => n.toLocaleString("en");
type Tab = "posts" | "saved" | "communities";

/**
 * Everything that is yours: what you posted, what you saved, your draft and
 * your communities. Other people's open problems are under Questions.
 */
export default async function Notebook({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const account = hasDatabase() ? await currentAccount() : undefined;
  const tab: Tab =
    params.tab === "saved" || params.tab === "communities"
      ? params.tab
      : params.tab === "posts" || account
        ? "posts"
        : "saved";
  const filter = params.show === "attention" ? "attention" : "all";
  const page = Math.max(1, Number(params.page) || 1);
  const joined = tab === "communities" ? await myCommunities(account) : [];
  const stats = joined.length
    ? await communityStats(
        joined.map((c) => c.slug),
        account,
      )
    : {};
  const tabs: [Tab, string][] = [
    ["posts", "Your posts"],
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
          What you asked and shared, what you saved, and your communities.
          Looking for other people’s problems to help with? Go to{" "}
          <Link className="text-link" href="/questions">
            Questions
          </Link>
          .
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
