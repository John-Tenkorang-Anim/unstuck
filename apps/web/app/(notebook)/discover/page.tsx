import { spectralClass } from "@/lib/communities";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Discovery } from "@/components/discovery";
import { QuestionList } from "@/components/question-list";
import { getNotebook } from "@/lib/api";
import { currentAccount } from "@/lib/auth.server";
import { communityStats, listCommunities } from "@/lib/communities.server";
import { hasDatabase } from "@/lib/db.server";
import { questionItems } from "@/lib/questions.server";

export const dynamic = "force-dynamic";
const number = (n: number) => n.toLocaleString("en");

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const account = hasDatabase() ? await currentAccount() : undefined;
  const [notebook, waiting, communities] = await Promise.all([
    getNotebook(),
    questionItems({ show: "open", size: 3 }).catch(() => undefined),
    listCommunities().catch(() => []),
  ]);
  const stats = await communityStats(
    communities.map((c) => c.slug),
    account,
  ).catch(() => ({}) as Awaited<ReturnType<typeof communityStats>>);
  // Your communities first, then the busiest.
  const shelf = [...communities]
    .sort(
      (a, b) =>
        Number(stats[b.slug]?.joined) - Number(stats[a.slug]?.joined) ||
        (stats[b.slug]?.questions ?? 0) +
          (stats[b.slug]?.library ?? 0) -
          ((stats[a.slug]?.questions ?? 0) + (stats[a.slug]?.library ?? 0)),
    )
    .slice(0, 4);
  return (
    <Discovery
      notebook={notebook}
      initialTopic={typeof params.topic === "string" ? params.topic : ""}
      initialQuery={typeof params.q === "string" ? params.q : ""}
      initialOutcome={typeof params.outcome === "string" ? params.outcome : ""}
      featured={
        <div key="featured" className="frame discover-featured">
          {waiting && waiting.items.length > 0 && (
            <section aria-labelledby="waiting-title">
              <div className="feature-head">
                <h2 id="waiting-title">Waiting for an answer</h2>
                <Link className="text-link" href="/search?type=questions">
                  {number(waiting.total)} open questions{" "}
                  <ChevronRight size={15} />
                </Link>
              </div>
              <QuestionList items={waiting.items} />
            </section>
          )}
          {shelf.length > 0 && (
            <section aria-labelledby="communities-title">
              <div className="feature-head">
                <h2 id="communities-title">Communities</h2>
                <Link className="text-link" href="/communities">
                  All communities <ChevronRight size={15} />
                </Link>
              </div>
              <ul className="community-strip">
                {shelf.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/communities/${c.slug}`}>
                      <span
                        className="community-mark"
                        data-class={spectralClass(c.slug)}
                        aria-hidden="true"
                      >
                        {c.name.slice(0, 1)}
                      </span>
                      <strong>{c.name}</strong>
                      <span>
                        {stats[c.slug]?.joined ? "You’re a member · " : ""}
                        {number(stats[c.slug]?.unanswered ?? 0)} waiting ·{" "}
                        {number(stats[c.slug]?.library ?? 0)} in the library
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      }
    />
  );
}
