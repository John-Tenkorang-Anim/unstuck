import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus, ShieldCheck } from "lucide-react";
import { CardActions, CompareTray } from "@/components/compare-tray";
import { HomeSearch } from "@/components/home-search";
import { RecordArt } from "@/components/record-art";
import { RisingTiles } from "@/components/rising-tiles";
import { RecordImage } from "@/components/record-image";
import { ProblemStatePill, Tabs } from "@/components/knowledge";
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
import { concernHref, concernReference } from "@/lib/concerns";
import { listConcerns } from "@/lib/concerns.server";

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
  const waiting =
    tab === "help"
      ? await listConcerns(
          { attention: true, size: 4, publicOnly: true },
          viewer,
        )
      : { items: [] as Awaited<ReturnType<typeof listConcerns>>["items"] };
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
  const featured = ranked.find((e) => !inJourneys.has(e.id)) ?? ranked[0];
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
        <RisingTiles />
        <h1 id="hero-title">What are you stuck on?</h1>
        <HomeSearch placeholder="Describe it in a few words: “pendulum lab gives the wrong g”" />
        <p className="dv-hint">
          Search what others tried, or press <b>Get help</b> to ask people
          who’ve faced it.
        </p>
      </section>

      <nav className="dv-categories" aria-label="Categories">
        <Link
          href={link({ category: "" })}
          aria-current={!category ? "true" : undefined}
        >
          All
        </Link>
        {used.slice(0, 6).map((c) => (
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

      {notebook.mode === "unavailable" && (
        <p className="review-notice" role="status">
          Some published records could not be loaded. Please try again shortly.
        </p>
      )}
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
                  <span className="dv-feature-image">
                    {featured.cover ? (
                      <RecordImage picture={featured.cover} featured />
                    ) : (
                      <RecordArt
                        seed={featured.id}
                        outcome={outcomeOf(featured, validated(featured))}
                      />
                    )}
                  </span>
                  <span className="dv-feature-text">
                    <span className="record-kicker">
                      Featured attempt{featured.example ? " · Sample" : ""}
                    </span>
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

          <section className="dv-section" aria-labelledby="more-title">
            <div className="dv-section-head">
              <h2 id="more-title">More to explore</h2>
            </div>
            <ul className="dv-tiles">
              {ranked
                .filter((e) => e.id !== featured?.id)
                .slice(0, 6)
                .map((e) => (
                  <li key={e.id}>
                    <Tile entry={e} validated={validated(e)} />
                  </li>
                ))}
            </ul>
            <Link className="text-link dv-all" href={link({ tab: "latest" })}>
              Everything, newest first <ArrowRight size={13} />
            </Link>
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
          {waiting.items.length > 0 && (
            <div className="dv-neighbours">
              <div className="dv-section-head">
                <h2>Neighbourhoods waiting for a response</h2>
                <Link className="text-link" href="/workspaces">
                  All workspaces <ArrowRight size={13} />
                </Link>
              </div>
              <ul className="dv-help">
                {waiting.items.map((c) => (
                  <li key={`${c.workspace}-${c.id}`}>
                    <div>
                      <span className="concern-ref">
                        {concernReference(c.number)}
                      </span>
                      <Link href={concernHref(c)}>
                        <strong>{c.title}</strong>
                      </Link>
                      <small>
                        {c.place || c.workspaceTitle} · {c.supporters} affected
                      </small>
                    </div>
                    <Link
                      className="button button-outline"
                      href={concernHref(c)}
                    >
                      I’m affected too
                    </Link>
                  </li>
                ))}
              </ul>
              <h2 className="sub-head">Problems that need help</h2>
            </div>
          )}
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
          <RecordArt seed={e.id} outcome={kind} />
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
/** The front page’s card: a picture, how it turned out, and the title. Nothing more. */
function Tile({
  entry: e,
  validated,
}: {
  entry: EntrySummary;
  validated: number;
}) {
  const kind = outcomeOf(e, validated);
  const picture = e.clip?.poster ?? e.cover;
  return (
    <article className="dv-tile">
      <span className="dv-tile-image" aria-hidden="true">
        {picture ? (
          <RecordImage picture={picture} />
        ) : (
          <RecordArt seed={e.id} outcome={kind} />
        )}
      </span>
      <span className="discovery-result" data-tone={outcomeTone[kind]}>
        {outcomeText[kind]}
      </span>
      <h3>
        <Link className="dv-link" href={`/entries/${e.id}`}>
          {e.title}
        </Link>
      </h3>
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
