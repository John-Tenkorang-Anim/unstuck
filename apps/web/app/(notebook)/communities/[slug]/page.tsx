import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  MessageCircleQuestion,
  Search,
} from "lucide-react";
import { JoinButton } from "@/components/community-actions";
import { AskBar, Library, QuestionList } from "@/components/question-list";
import { ReportButton } from "@/components/report-button";
import { currentAccount } from "@/lib/auth.server";
import { isQuestion } from "@/lib/communities";
import { communityBySlug, communityStats } from "@/lib/communities.server";
import { hasDatabase } from "@/lib/db.server";
import {
  communityPool,
  questionItems,
  type Show,
} from "@/lib/questions.server";

export const dynamic = "force-dynamic";
const number = (n: number) => n.toLocaleString("en");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const community = await communityBySlug((await params).slug).catch(
    () => undefined,
  );
  return {
    title: community?.name ?? "Community not found",
    description: community?.about,
  };
}

export default async function CommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const account = hasDatabase() ? await currentAccount() : undefined;
  const community = await communityBySlug(slug, account);
  if (!community) notFound();
  // Moderators' links use the id; everyone else sees the readable address.
  if (community.slug !== slug) redirect(`/communities/${community.slug}`);
  const tab = query.tab === "library" ? "library" : "questions";
  const show: Show =
    query.show === "all" || query.show === "answered" ? query.show : "open";
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const [stats, questions, pool] = await Promise.all([
    communityStats([slug], account).then((s) => s[slug]),
    questionItems({ communities: [slug], show, q }),
    tab === "library" ? communityPool(slug) : Promise.resolve([]),
  ]);
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const library = pool.filter(
    (e) =>
      !isQuestion(e.kind) &&
      terms.every((t) => `${e.title} ${e.excerpt}`.toLowerCase().includes(t)),
  );
  const base = `/communities/${slug}`;
  const link = (change: Record<string, string>) => {
    const next = new URLSearchParams({
      ...(tab === "library" ? { tab } : {}),
      ...(show !== "open" ? { show } : {}),
      ...(q ? { q } : {}),
      ...change,
    });
    [...next.entries()].forEach(([k, v]) => !v && next.delete(k));
    return `${base}${next.size ? `?${next}` : ""}`;
  };
  return (
    <div className="frame community">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/communities" className="back-link">
          <ArrowLeft size={14} /> Communities
        </Link>
        <span aria-hidden="true">/</span>
        <span>{community.topic}</span>
      </nav>
      <header className="community-head">
        <span
          className="community-mark community-mark-large"
          aria-hidden="true"
        >
          {community.name.slice(0, 1)}
        </span>
        <div className="community-head-text">
          <h1>{community.name}</h1>
          <p>{community.about}</p>
          <dl className="community-stats">
            <div>
              <dt>Members</dt>
              <dd>{number(stats.members)}</dd>
            </div>
            <div>
              <dt>Questions</dt>
              <dd>{number(stats.questions)}</dd>
            </div>
            <div>
              <dt>Waiting for an answer</dt>
              <dd>{number(stats.unanswered)}</dd>
            </div>
            <div>
              <dt>In the library</dt>
              <dd>{number(stats.library)}</dd>
            </div>
          </dl>
        </div>
        <div className="community-head-actions">
          <JoinButton
            slug={slug}
            name={community.name}
            joined={stats.joined}
            members={stats.members}
            enabled={hasDatabase()}
          />
          <Link className="text-link" href={`/new?community=${slug}`}>
            Add what you tried to the library
          </Link>
          {community.hidden && (
            <p className="review-notice">This community is hidden.</p>
          )}
        </div>
      </header>
      {community.sample && (
        <p className="example-notice">
          <span className="example-tag">Sample community</span> Its questions
          and notes are fictional examples. Joining and posting are real.
        </p>
      )}

      <AskBar
        community={slug}
        placeholder={`Ask ${community.name} a question`}
      />

      <nav className="community-tabs" aria-label="In this community">
        <Link
          href={base}
          aria-current={tab === "questions" ? "page" : undefined}
        >
          <MessageCircleQuestion size={16} aria-hidden="true" /> Questions
          <span>{number(stats.questions)}</span>
        </Link>
        <Link
          href={`${base}?tab=library`}
          aria-current={tab === "library" ? "page" : undefined}
        >
          <BookOpen size={16} aria-hidden="true" /> Library
          <span>{number(stats.library)}</span>
        </Link>
        <form className="community-search" action={base}>
          {tab === "library" && (
            <input type="hidden" name="tab" value="library" />
          )}
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            aria-label={
              tab === "library" ? "Search the library" : "Search questions"
            }
            placeholder={
              tab === "library" ? "Search the library" : "Search questions"
            }
          />
        </form>
      </nav>

      {tab === "questions" ? (
        <section aria-label="Questions">
          <nav className="serp-fields" aria-label="Show">
            {(
              [
                ["open", "Waiting for an answer"],
                ["answered", "Answered"],
                ["all", "All questions"],
              ] as const
            ).map(([value, label]) => (
              <Link
                key={value}
                href={link({ show: value === "open" ? "" : value })}
                aria-current={show === value ? "true" : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
          {questions.items.length ? (
            <QuestionList items={questions.items} hideCommunity={slug} />
          ) : (
            <div className="empty-state">
              <h3>
                {show === "open"
                  ? "Every question here has a response."
                  : "No questions yet."}
              </h3>
              <p>Ask the first one with the box above.</p>
            </div>
          )}
        </section>
      ) : library.length ? (
        <Library entries={library} />
      ) : (
        <div className="empty-state">
          <h3>The library is empty so far.</h3>
          <p>
            Post what you tried, and whether it worked, so the next member
            starts further along.
          </p>
          <Link className="button button-dark" href={`/new?community=${slug}`}>
            Add to the library
          </Link>
        </div>
      )}
      {community.id && (
        <div className="community-foot">
          <ReportButton type="community" id={community.id} />
        </div>
      )}
    </div>
  );
}
