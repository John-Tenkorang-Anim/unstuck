import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus, ShieldCheck } from "lucide-react";
import { CardActions, CompareTray } from "@/components/compare-tray";
import { HomeSearch } from "@/components/home-search";
import { RecordImage } from "@/components/record-image";
import {
  branchesFor,
  MiniTrail,
  ProblemStatePill,
  Tabs,
} from "@/components/knowledge";
import { getNotebook } from "@/lib/api";
import { currentAccount } from "@/lib/auth.server";
import { listCommunities } from "@/lib/communities.server";
import { improvementCounts } from "@/lib/improvements.server";
import {
  evidenceOf,
  outcomeOf,
  outcomeText,
  outcomeTone,
  type OutcomeKind,
} from "@/lib/outcome";
import { problemsWithWork } from "@/lib/problems.server";
import { profileById } from "@/lib/profile.server";
import { lessonLabel, type EntrySummary } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Discover" };

const tabs = [
  ["for-you", "For you"],
  ["latest", "Latest"],
  ["lessons", "Lessons"],
  ["help", "Needs help"],
] as const;
type Tab = (typeof tabs)[number][0];
const outcomes: [OutcomeKind | "improved" | "", string][] = [
  ["", "Any outcome"],
  ["failed", "Failed"],
  ["partial", "Partially worked"],
  ["improved", "Supported follow-ups"],
  ["worked", "Worked"],
];

/**
 * Discover: an editorial front page. Few words, strong pictures, and every
 * section a different way in: a featured story, problems being worked on,
 * attempts that led to improvements, lessons, then everything else.
 */
export default async function Discover({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (k: string) => (typeof params[k] === "string" ? params[k] : "");
  const tab = (tabs.find(([k]) => k === one("tab"))?.[0] ?? "for-you") as Tab;
  const category = one("category");
  const outcome = outcomes.find(([k]) => k && k === one("outcome"))?.[0] ?? "";

  const viewer = await currentAccount();
  const [notebook, categories, work, profile] = await Promise.all([
    getNotebook(),
    listCommunities(),
    problemsWithWork(),
    viewer ? profileById(viewer.id) : undefined,
  ]);
  const counts = await improvementCounts(notebook.entries.map((e) => e.id));
  const validated = (e: EntrySummary) => counts.get(e.id)?.validated ?? 0;
  const attempts = notebook.entries.filter(
    (e) =>
      e.kind !== "problem" && (!category || e.communities?.includes(category)),
  );
  // Personal only when someone chose interests; the reason is always shown.
  const interests = profile?.interests ?? [];
  const interesting = interests.length
    ? attempts.filter((e) =>
        interests.some((i) =>
          `${e.topic} ${e.communities?.join(" ")}`
            .toLowerCase()
            .includes(i.toLowerCase()),
        ),
      )
    : [];
  const pool = interesting.length ? interesting : attempts;
  const score = (e: EntrySummary) =>
    (counts.get(e.id)?.total ?? 0) * 4 +
    evidenceOf(e).level * 3 +
    (e.cover ? 2 : 0) +
    e.helped / 10;
  const ranked = [...pool].sort((a, b) => score(b) - score(a));
  const inJourneys = new Set(
    work.flatMap((w) => w.improvements.map((i) => i.entryId)),
  );
  const featured =
    ranked.find((e) => e.cover && !inJourneys.has(e.id)) ??
    ranked.find((e) => e.cover);
  const used = categories
    .map((c) => ({
      c,
      n: notebook.entries.filter((e) => e.communities?.includes(c.slug)).length,
    }))
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n)
    .map((x) => x.c);
  const active = work
    .filter(
      (w) =>
        w.state !== "archived" &&
        (!category || w.problem.categorySlug === category),
    )
    .sort((a, b) => b.updated.localeCompare(a.updated));
  const journeys = active
    .flatMap((w) =>
      branchesFor(w.attempts, w.improvements, w.tests)
        .filter((b) => b.attempt && b.improvement)
        .map((b) => ({ b, w })),
    )
    .slice(0, 3);
  const lessons = attempts
    .flatMap((e) => (e.lessons ?? []).map((l) => ({ l, e })))
    .filter(({ l }) => l.kind === "recommendation");
  const help = active.filter(
    (w) => w.state === "open" || w.problem.needs.length,
  );
  const allLessons = attempts.flatMap((e) =>
    (e.lessons ?? []).map((l, i) => ({ l, e, i })),
  );
  const link = (change: Record<string, string>) => {
    const next = new URLSearchParams({
      ...(tab !== "for-you" ? { tab } : {}),
      ...(category ? { category } : {}),
      ...(outcome ? { outcome } : {}),
      ...change,
    });
    for (const [k, v] of [...next]) if (!v) next.delete(k);
    return `/discover${next.size ? `?${next}` : ""}`;
  };
  const grid = (list: EntrySummary[]) => (
    <ul className="discovery-index">
      {list.map((e) => (
        <li key={e.id}>
          <Card
            entry={e}
            validated={validated(e)}
            category={
              categories.find((c) => c.slug === e.communities?.[0])?.name
            }
          />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="discover frame">
      <section className="dv-hero" aria-labelledby="hero-title">
        <h1 id="hero-title">Discover what we’ve learned.</h1>
        <HomeSearch placeholder="Search a problem, a failed attempt, or something you’re trying to improve…" />
      </section>

      <nav className="dv-categories" aria-label="Categories">
        <Link
          href={link({ category: "" })}
          aria-current={!category ? "true" : undefined}
        >
          All
        </Link>
        {used.map((c) => (
          <Link
            key={c.slug}
            href={link({ category: c.slug })}
            aria-current={category === c.slug ? "true" : undefined}
          >
            {c.name}
          </Link>
        ))}
        <Link href="/communities" className="dv-more">
          <Plus size={14} aria-hidden="true" /> More
        </Link>
      </nav>

      <Tabs
        label="Discover"
        current={tab}
        href={(k) => link({ tab: k === "for-you" ? "" : k, outcome: "" })}
        tabs={tabs}
      />

      {(notebook.mode === "examples" || notebook.mode === "mixed") && (
        <p className="example-notice">
          <span className="example-tag">Sample data</span> Illustrative records
          are marked as samples.
        </p>
      )}

      {notebook.mode === 'unavailable' && <p className="review-notice" role="status">Some published records could not be loaded. Please try again shortly.</p>}
      {tab === "for-you" && (
        <>
          {interests.length > 0 ? (
            <p className="tab-note">
              Based on your interests: {interests.join(", ")}.{" "}
              <Link className="text-link" href="/account#profile">
                Change
              </Link>
            </p>
          ) : (
            viewer && (
              <p className="tab-note">
                There’s a whole world of experiences to explore. Start with
                something you’re curious about.{" "}
                <Link className="text-link" href="/account#profile">
                  Choose interests
                </Link>
              </p>
            )
          )}
          {!attempts.length && <Empty />}
          <div className="dv-lead">
            {featured && (
              <article className="dv-feature">
                <Link
                  href={`/entries/${featured.id}`}
                  className="dv-feature-link"
                >
                  <RecordImage picture={featured.cover!} featured />
                  <span className="dv-feature-text">
                    <span
                      className="pill"
                      data-tone={
                        outcomeTone[outcomeOf(featured, validated(featured))]
                      }
                    >
                      <i aria-hidden="true" />
                      {outcomeText[outcomeOf(featured, validated(featured))]}
                    </span>
                    <strong>{featured.title}</strong>
                    {featured.lessons?.find(
                      (l) => l.kind === "recommendation",
                    ) && (
                      <span>
                        {
                          featured.lessons.find(
                            (l) => l.kind === "recommendation",
                          )!.text
                        }
                      </span>
                    )}
                  </span>
                </Link>
              </article>
            )}
            <section className="dv-side" aria-labelledby="working-title">
              <div className="dv-section-head">
                <h2 id="working-title">What people are working on</h2>
                <Link className="text-link" href="/problems">
                  All <ArrowRight size={13} />
                </Link>
              </div>
              {!active.length && (
                <p className="quiet-line">
                  No problems shared in this selection yet.
                </p>
              )}
              <ul className="dv-problems">
                {active.slice(0, 5).map((w) => (
                  <li key={w.problem.id}>
                    <Link href={`/problems/${w.problem.id}`}>
                      <strong>{w.problem.title}</strong>
                      <small>
                        {w.problem.category} · {w.attempts.length}{" "}
                        {w.attempts.length === 1 ? "attempt" : "attempts"}
                      </small>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {journeys.length > 0 && (
            <section className="dv-section" aria-labelledby="journeys-title">
              <div className="dv-section-head">
                <h2 id="journeys-title">From failure to improvement</h2>
              </div>
              <ul className="dv-journeys">
                {journeys.map(({ b, w }) => (
                  <li key={b.improvement!.id}>
                    <Link href={`/problems/${w.problem.id}?tab=progress`}>
                      <span className="dv-journey-image">
                        {b.attempt!.cover && (
                          <RecordImage picture={b.attempt!.cover} />
                        )}
                      </span>
                      <div className="dv-journey-copy">
                        <strong>{b.improvement!.title}</strong>
                        <MiniTrail branch={b} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {lessons.length > 0 && (
            <section className="dv-section" aria-labelledby="lessons-title">
              <div className="dv-section-head">
                <h2 id="lessons-title">Lessons worth sharing</h2>
                <Link className="text-link" href={link({ tab: "lessons" })}>
                  More <ArrowRight size={13} />
                </Link>
              </div>
              <ul className="dv-lessons">
                {lessons.slice(0, 3).map(({ l, e }) => (
                  <li key={`${e.id}-${l.text}`}>
                    <Link href={`/entries/${e.id}?tab=lessons`}>
                      <q>{l.text}</q>
                      <small>{e.title}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="dv-section" aria-labelledby="more-title">
            <div className="dv-section-head">
              <h2 id="more-title">More to explore</h2>
            </div>
            {grid(ranked.filter((e) => e.id !== featured?.id).slice(0, 8))}
          </section>
        </>
      )}

      {tab === "latest" && (
        <section className="dv-section">
          <div className="dv-section-head">
            <nav className="seg" aria-label="Outcome">
              {outcomes.map(([k, l]) => (
                <Link
                  key={k}
                  href={link({ outcome: k })}
                  aria-current={outcome === k ? "true" : undefined}
                >
                  {l}
                </Link>
              ))}
            </nav>
          </div>
          {(() => {
            const list = [...attempts]
              .filter(
                (e) =>
                  !outcome ||
                  (outcome === "improved"
                    ? validated(e) > 0
                    : outcomeOf(e) === outcome),
              )
              .sort((a, b) => b.date.localeCompare(a.date));
            return list.length ? grid(list) : <Empty />;
          })()}
        </section>
      )}

      {tab === "lessons" && (
        <section className="dv-section">
          <ul className="dv-lessons dv-lessons-all">
            {allLessons.map(({ l, e, i }) => (
              <li key={`${e.id}-${i}`}>
                <Link href={`/entries/${e.id}?tab=lessons`}>
                  <span className="claim-kind">{lessonLabel[l.kind]}</span>
                  <q>{l.text}</q>
                  <small>{e.title}</small>
                </Link>
              </li>
            ))}
          </ul>
          {!allLessons.length && (
            <p className="empty-state">
              No lessons in this selection yet. Choose another category or share
              what you learned.
            </p>
          )}
          <Link className="text-link" href="/lessons">
            Patterns and guides in the Lessons library <ArrowRight size={13} />
          </Link>
        </section>
      )}

      {tab === "help" && (
        <section className="dv-section">
          {!help.length && (
            <p className="empty-state">
              No open requests in this selection.{" "}
              <Link className="text-link" href="/new?type=problem">
                Share a problem
              </Link>
            </p>
          )}
          <ul className="dv-help">
            {help.map((w) => (
              <li key={w.problem.id}>
                <div>
                  <ProblemStatePill state={w.state} />
                  <Link href={`/problems/${w.problem.id}`}>
                    <strong>{w.problem.title}</strong>
                  </Link>
                  {w.problem.needs[0] && (
                    <small>Needs {w.problem.needs[0].toLowerCase()}</small>
                  )}
                </div>
                <Link
                  className="button button-outline"
                  href={`/new?type=attempt&problem=${w.problem.id}`}
                >
                  I faced this too
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <CompareTray />
    </div>
  );
}

function Card({
  entry: e,
  validated,
  category,
}: {
  entry: EntrySummary;
  validated: number;
  category?: string;
}) {
  const kind = outcomeOf(e, validated);
  const evidence = evidenceOf(e);
  const picture = e.clip?.poster ?? e.cover;
  return (
    <article className="discovery-row">
      <Link
        href={`/entries/${e.id}`}
        className="discovery-image"
        tabIndex={-1}
        aria-hidden="true"
      >
        {picture ? (
          <RecordImage picture={picture} />
        ) : (
          <span className="discovery-monogram">
            {(category ?? e.topic).slice(0, 1)}
          </span>
        )}
      </Link>
      <div className="discovery-copy">
        <p className="discovery-category">
          {category ?? e.topic}
          {e.example && <span>Sample</span>}
        </p>
        <h3>
          <Link href={`/entries/${e.id}`}>{e.title}</Link>
        </h3>
        <p className="discovery-excerpt">{e.excerpt}</p>
        <p className="discovery-context">
          <span className="discovery-result" data-tone={outcomeTone[kind]}>
            {outcomeText[kind]}
          </span>
          <span>{e.place}</span>
          {validated > 0 && (
            <span>
              {validated} supported{" "}
              {validated === 1 ? "follow-up" : "follow-ups"}
            </span>
          )}
          {evidence.level >= 2 && (
            <span className="discovery-evidence">
              <ShieldCheck size={13} aria-hidden="true" />
              {evidence.label}
            </span>
          )}
        </p>
      </div>
      <CardActions id={e.id} title={e.title} />
    </article>
  );
}
function Empty() {
  return (
    <div className="empty-state">
      <h3>Nothing matches yet.</h3>
      <Link className="button button-dark" href="/new">
        Contribute <ArrowRight size={15} />
      </Link>
    </div>
  );
}
