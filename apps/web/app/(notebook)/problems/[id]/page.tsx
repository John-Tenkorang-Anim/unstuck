import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  FlaskConical,
  GitBranch,
  HandHelping,
  Info,
  Plus,
  Scale,
} from "lucide-react";
import { Discussion } from "@/components/discussion";
import {
  AttemptOutcome,
  branchesFor,
  EvidenceTag,
  Pill,
  ProblemStatePill,
  ProgressTrail,
  ProposalStatus,
  RailBlock,
  Tabs,
} from "@/components/knowledge";
import { RecordActions } from "@/components/record-actions";
import { ReportButton } from "@/components/report-button";
import { getEntry } from "@/lib/api";
import { currentAccount, publicAccount } from "@/lib/auth.server";
import { hasDatabase } from "@/lib/db.server";
import {
  discussionSummary,
  listComments,
  problemKey,
} from "@/lib/discussion.server";
import { isFollowing } from "@/lib/follows.server";
import { evidenceOf, outcomeOf, type OutcomeKind } from "@/lib/outcome";
import { knowledgeLabel } from "@/lib/problems";
import { problemWork } from "@/lib/problems.server";
import { testStatusLabel } from "@/lib/tests";
import { verdictLabel } from "@/lib/improvements";
import type { Entry } from "@/lib/types";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const w = await problemWork((await params).id);
  return {
    title: w?.problem.title ?? "Problem not found",
    description: w?.problem.summary,
  };
}

const tabs = [
  ["overview", "Overview"],
  ["attempts", "Attempts"],
  ["improvements", "Improvements"],
  ["tests", "Tests"],
  ["discussion", "Discussion"],
  ["progress", "Progress"],
] as const;
type Tab = (typeof tabs)[number][0];
const offers: Record<string, string> = {
  expertise:
    "You’re offering expertise. Say what you know and how you could help.",
  evidence: "You’re adding evidence. Describe it and where it comes from.",
  testing: "You’re offering to help test. Say what you could run and where.",
  resources:
    "You’re offering equipment or funding. Say what and under what conditions.",
};

/**
 * Problem detail: the evolving home for a challenge. What it is, everything
 * tried, the improvements and tests, the discussion and the trail of progress.
 */
export default async function ProblemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const w = await problemWork(id);
  if (!w) notFound();
  const query = await searchParams;
  const one = (k: string) => (typeof query[k] === "string" ? query[k] : "");
  const tab = (tabs.find(([k]) => k === one("tab"))?.[0] ?? "overview") as Tab;
  const viewer = await currentAccount();
  const p = w.problem;
  const attempts = (
    await Promise.all(
      w.attempts.map((a) => getEntry(a.id).catch(() => undefined)),
    )
  ).filter((e): e is Entry => !!e);
  const branches = branchesFor(w.attempts, w.improvements, w.tests);
  const key = problemKey(p.id);
  const [following, summary, firstPage] = await Promise.all([
    isFollowing(viewer, "problem", p.id),
    tab === "discussion"
      ? discussionSummary({ id: key, evidence: [] } as unknown as Entry)
      : undefined,
    tab === "discussion"
      ? listComments(key, { viewer: viewer?.id }).catch(() => ({
          items: [],
          next: null,
          count: 0,
        }))
      : undefined,
  ]);
  // Every reference resolves to the record it came from.
  const refs = new Map<string, { label: string; href: string }>([
    ...attempts.map(
      (a) => [a.id, { label: a.title, href: `/entries/${a.id}` }] as const,
    ),
    ...w.improvements.map(
      (i) => [i.id, { label: i.title, href: `/improvements/${i.id}` }] as const,
    ),
    ...w.tests.map(
      (t) => [t.id, { label: t.title, href: `/tests/${t.id}` }] as const,
    ),
  ]);
  if (w.origin)
    refs.set(w.origin.id, {
      label: w.origin.title,
      href: `/entries/${w.origin.id}`,
    });
  const outcomeFilter = one("outcome") as OutcomeKind | "";
  const filtered = attempts.filter(
    (a) => !outcomeFilter || outcomeOf(a) === outcomeFilter,
  );
  const strongest = attempts.reduce(
    (best, a) => Math.max(best, evidenceOf(a).level),
    -1,
  );
  const href = (t: string) =>
    `/problems/${p.id}${t === "overview" ? "" : `?tab=${t}`}`;
  const events = [
    {
      at: p.created,
      who: p.author,
      what: "Described the problem",
      href: `/problems/${p.id}`,
    },
    ...attempts.map((a) => ({
      at: a.date,
      who: a.alias,
      what: `Shared “${a.title}”`,
      href: `/entries/${a.id}`,
    })),
    ...w.improvements.flatMap((i) =>
      i.events
        .filter((e) => e.kind === "created" || e.kind === "status")
        .map((e) => ({
          at: e.created,
          who: e.actor,
          what:
            e.kind === "created"
              ? `Proposed “${i.title}”`
              : `Moved “${i.title}” to ${e.to}`,
          href: `/improvements/${i.id}`,
        })),
    ),
    ...w.tests.flatMap((t) => [
      {
        at: t.created,
        who: t.author,
        what: `Planned the test “${t.title}”`,
        href: `/tests/${t.id}`,
      },
      ...(t.findings
        ? [
            {
              at: t.updated,
              who: t.author,
              what: `Published findings: ${t.findings.verdict ? verdictLabel[t.findings.verdict] : "no verdict"}`,
              href: `/tests/${t.id}?tab=findings`,
            },
          ]
        : []),
    ]),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="frame knowledge-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/problems" className="back-link">
          <ArrowLeft size={14} /> Problems
        </Link>
        {p.categorySlug && (
          <>
            <span aria-hidden="true">/</span>
            <Link href={`/communities/${p.categorySlug}`}>{p.category}</Link>
          </>
        )}
      </nav>
      {p.sample && (
        <p className="example-notice">
          <span className="example-tag">
            {p.historical ? "Historical case" : "Sample data"}
          </span>{" "}
          {p.historical
            ? "A documented failure, used to show how a problem’s history is recorded."
            : "A fictional problem, used to show how Unstuck works."}
        </p>
      )}
      <header className="record-head">
        <p className="record-kicker">
          {[p.category, ...(p.subtopics ?? []).slice(0, 2)].join(" · ")}
        </p>
        <h1>{p.title}</h1>
        <div className="record-status">
          <ProblemStatePill state={w.state} />
          {w.state !== "archived" && (
            <Pill tone="ongoing">Open for improvements</Pill>
          )}
          <span className="record-meta">
            Described by {p.author} · {p.created.slice(0, 10)}
          </span>
        </div>
        <p className="record-lede">{p.summary}</p>
        <div className="record-actions-row">
          <Link
            className="button button-dark"
            href={`/new?type=attempt&problem=${p.id}`}
          >
            <Plus size={15} /> Add an attempt
          </Link>
          <Link
            className="button button-outline"
            href={`/improvements/new?problem=${p.id}`}
          >
            <GitBranch size={15} /> Propose an improvement
          </Link>
          <RecordActions
            save={`problem:${p.id}`}
            follow={{
              type: "problem",
              id: p.id,
              following,
              enabled: hasDatabase(),
            }}
            cite={{
              title: p.title,
              author: p.author,
              date: p.created,
              path: `/problems/${p.id}`,
              kind: "Problem",
            }}
          />
        </div>
      </header>

      <Tabs
        label="Problem"
        current={tab}
        href={href}
        tabs={tabs.map(
          ([k, l]) =>
            [
              k,
              l,
              k === "attempts"
                ? attempts.length
                : k === "improvements"
                  ? w.improvements.length
                  : k === "tests"
                    ? w.tests.length
                    : undefined,
            ] as const,
        )}
      />

      <div
        className={
          tab === "overview"
            ? "knowledge-grid"
            : "knowledge-grid knowledge-grid-two"
        }
      >
        {tab === "overview" && (
          <aside className="knowledge-nav" aria-label="On this page">
            <ol className="toc">
              {[
                ["the-problem", "The problem"],
                ["tried", "What has been tried"],
                ["known", "What we currently know"],
                ["unknown", "What still needs investigation"],
                ["trail", "Progress trail"],
              ].map(([a, l]) => (
                <li key={a}>
                  <a href={`#${a}`}>{l}</a>
                </li>
              ))}
            </ol>
          </aside>
        )}

        <div className="knowledge-main">
          {tab === "overview" && (
            <>
              <section id="the-problem" className="prose-block">
                <h2>The problem</h2>
                <p>{p.summary}</p>
                {w.origin && (
                  <p className="quiet-line">
                    First described in{" "}
                    <Link
                      className="text-link"
                      href={`/entries/${w.origin.id}`}
                    >
                      {w.origin.title}
                    </Link>
                  </p>
                )}
                <dl className="facts">
                  {p.affects && (
                    <div>
                      <dt>Who or what it affects</dt>
                      <dd>{p.affects}</dd>
                    </div>
                  )}
                  {p.matters && (
                    <div>
                      <dt>Why it matters</dt>
                      <dd>{p.matters}</dd>
                    </div>
                  )}
                  {p.constraints.length > 0 && (
                    <div>
                      <dt>Known constraints</dt>
                      <dd>
                        <ul className="dash-list">
                          {p.constraints.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
              <section id="tried" className="prose-block">
                <h2>What has been tried</h2>
                {attempts.length ? (
                  <ul className="row-list">
                    {attempts.map((a) => (
                      <li key={a.id}>
                        <Link href={`/entries/${a.id}`}>{a.title}</Link>
                        <AttemptOutcome entry={a} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="quiet-line">
                    No attempts have been shared yet.{" "}
                    <Link
                      className="text-link"
                      href={`/new?type=attempt&problem=${p.id}`}
                    >
                      Have you tried something similar?
                    </Link>
                  </p>
                )}
              </section>
              <section id="known" className="prose-block">
                <h2>What we currently know</h2>
                {p.known.length ? (
                  <ul className="claims">
                    {p.known.map((k, i) => (
                      <li key={i} data-kind={k.kind}>
                        <span className="claim-kind">
                          {knowledgeLabel[k.kind]}
                        </span>
                        <p>{k.text}</p>
                        {k.refs.length > 0 && (
                          <p className="claim-refs">
                            Based on{" "}
                            {k.refs.map((r, n) => {
                              const ref = refs.get(r);
                              return (
                                <span key={r}>
                                  {n > 0 && ", "}
                                  {ref ? (
                                    <Link href={ref.href}>{ref.label}</Link>
                                  ) : (
                                    r
                                  )}
                                </span>
                              );
                            })}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="quiet-line">
                    Nothing summarised yet. Attempts and tests will build this
                    up.
                  </p>
                )}
                <p className="aside-note">
                  <Info size={14} aria-hidden="true" />
                  <span>
                    Something that worked here worked{" "}
                    <em>under these conditions</em>. It isn’t a claim that the
                    problem is solved everywhere.
                  </span>
                </p>
              </section>
              <section id="unknown" className="prose-block">
                <h2>What still needs investigation</h2>
                {p.unknowns.length ? (
                  <ul className="dash-list">
                    {p.unknowns.map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="quiet-line">No open questions recorded.</p>
                )}
              </section>
              <section id="trail" className="prose-block">
                <h2>Progress trail</h2>
                <ProgressTrail problem={p} branches={branches} compact />
              </section>
            </>
          )}

          {tab === "attempts" && (
            <section className="prose-block">
              <div className="block-head">
                <h2>Attempts</h2>
                <nav className="seg" aria-label="Filter by outcome">
                  {[
                    ["", "All"],
                    ["failed", "Failed"],
                    ["partial", "Partially worked"],
                    ["worked", "Worked"],
                    ["progress", "In progress"],
                  ].map(([k, l]) => (
                    <Link
                      key={k}
                      href={`/problems/${p.id}?tab=attempts${k ? `&outcome=${k}` : ""}${one("view") ? `&view=${one("view")}` : ""}`}
                      aria-current={outcomeFilter === k ? "true" : undefined}
                    >
                      {l}
                    </Link>
                  ))}
                </nav>
                <nav className="seg" aria-label="View">
                  <Link
                    href={`/problems/${p.id}?tab=attempts`}
                    aria-current={
                      one("view") !== "timeline" ? "true" : undefined
                    }
                  >
                    List
                  </Link>
                  <Link
                    href={`/problems/${p.id}?tab=attempts&view=timeline`}
                    aria-current={
                      one("view") === "timeline" ? "true" : undefined
                    }
                  >
                    Timeline
                  </Link>
                </nav>
              </div>
              {filtered.length === 0 && (
                <p className="quiet-line">
                  No attempts match. Have you tried something similar?
                </p>
              )}
              <ol
                className={
                  one("view") === "timeline" ? "attempts timeline" : "attempts"
                }
              >
                {(one("view") === "timeline"
                  ? [...filtered].sort((a, b) => a.date.localeCompare(b.date))
                  : filtered
                ).map((a) => {
                  const approach = a.sections.find((s) =>
                    /attempt|tried|method|approach/i.test(s.title),
                  )?.body;
                  return (
                    <li key={a.id} className="attempt-row">
                      {one("view") === "timeline" && (
                        <time className="attempt-date">{a.date}</time>
                      )}
                      <div>
                        <div className="attempt-top">
                          <AttemptOutcome entry={a} />
                          <EvidenceTag entry={a} />
                        </div>
                        <h3>
                          <Link href={`/entries/${a.id}`}>{a.title}</Link>
                        </h3>
                        {approach && (
                          <p>
                            <b>Approach.</b> {approach}
                          </p>
                        )}
                        {Object.keys(a.context).length > 0 && (
                          <p className="conditions">
                            {Object.entries(a.context)
                              .slice(0, 4)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ")}
                          </p>
                        )}
                        {a.evidence[0] && (
                          <p className="quiet-line">
                            Strongest evidence: {a.evidence[0].label}
                          </p>
                        )}
                        <p className="record-meta">
                          {a.alias} · {a.place} · {a.date}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <Link
                className="button button-outline"
                href={`/new?type=attempt&problem=${p.id}`}
              >
                <Plus size={15} /> Add an attempt
              </Link>
            </section>
          )}

          {tab === "improvements" && (
            <section className="prose-block">
              <div className="block-head">
                <h2>Improvements</h2>
                <Link
                  className="button button-dark"
                  href={`/improvements/new?problem=${p.id}`}
                >
                  <Plus size={15} /> Propose an improvement
                </Link>
              </div>
              {w.improvements.length === 0 && (
                <p className="quiet-line">
                  No improvements proposed yet. Start one from an attempt or
                  from here.
                </p>
              )}
              <ul className="proposal-list">
                {w.improvements.map((i) => {
                  const its = w.tests.filter((t) => t.improvementId === i.id);
                  const talk = i.events.filter(
                    (e) => e.kind !== "created" && e.kind !== "status",
                  ).length;
                  return (
                    <li key={i.id} className="proposal-row">
                      <div className="attempt-top">
                        <ProposalStatus improvement={i} />
                      </div>
                      <h3>
                        <Link href={`/improvements/${i.id}`}>{i.title}</Link>
                      </h3>
                      <p>{i.change}</p>
                      <p className="record-meta">
                        {i.author}
                        {i.collaborators.length > 0 &&
                          ` with ${i.collaborators.join(", ")}`}{" "}
                        · {talk} {talk === 1 ? "contribution" : "contributions"}{" "}
                        ·{" "}
                        {its.length
                          ? `${its.length} ${its.length === 1 ? "test" : "tests"}`
                          : "Not tested yet"}
                        {i.evidence && " · Evidence attached"}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {tab === "tests" && (
            <section className="prose-block">
              <div className="block-head">
                <h2>Tests</h2>
              </div>
              {w.tests.length === 0 ? (
                <p className="quiet-line">
                  No tests yet. Tests start from an improvement proposal, so
                  each result stays linked to what it evaluates.
                </p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Test</th>
                        <th scope="col">Evaluates</th>
                        <th scope="col">Conditions</th>
                        <th scope="col">Status</th>
                        <th scope="col">What happened</th>
                      </tr>
                    </thead>
                    <tbody>
                      {w.tests.map((t) => {
                        const imp = w.improvements.find(
                          (i) => i.id === t.improvementId,
                        );
                        return (
                          <tr key={t.id}>
                            <th scope="row">
                              <Link href={`/tests/${t.id}`}>{t.title}</Link>
                            </th>
                            <td>
                              {imp ? (
                                <Link href={`/improvements/${imp.id}`}>
                                  {imp.title}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>{t.conditions.join("; ") || "—"}</td>
                            <td>{testStatusLabel[t.status]}</td>
                            <td>
                              {t.findings
                                ? `${t.findings.verdict ? verdictLabel[t.findings.verdict] : "No verdict"}: ${t.findings.happened}`
                                : t.runs.length
                                  ? `${t.runs.length} ${t.runs.length === 1 ? "run" : "runs"} so far`
                                  : "Not started"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {tab === "discussion" && summary && firstPage && (
            <section className="prose-block">
              <h2>Discussion</h2>
              {offers[one("offer")] && (
                <p className="aside-note">
                  <HandHelping size={14} aria-hidden="true" />{" "}
                  {offers[one("offer")]}
                </p>
              )}
              <p className="quiet-line">
                Ask questions, share observations, point out missing evidence or
                challenge assumptions.
              </p>
              <Discussion
                entryId={key}
                summary={summary}
                first={firstPage}
                viewer={publicAccount(viewer)}
                isOwner={!!viewer && viewer.id === p.owner}
                enabled={hasDatabase()}
              />
            </section>
          )}

          {tab === "progress" && (
            <section className="prose-block">
              <h2>Progress</h2>
              <p className="quiet-line">
                Each branch follows one line of work, from an attempt to the
                improvements it led to and what testing found.
              </p>
              <ProgressTrail problem={p} branches={branches} />
              <h3 className="sub-head">Timeline</h3>
              <ol className="history">
                {events.map((e, i) => (
                  <li key={i}>
                    <time dateTime={e.at}>{e.at.slice(0, 10)}</time>
                    <span>
                      <b>{e.who}</b> <Link href={e.href}>{e.what}</Link>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <aside className="knowledge-rail">
          <RailBlock title="Contributors">
            <ul className="people">
              {w.contributors.slice(0, 8).map((c) => (
                <li key={c}>
                  <span className="avatar" aria-hidden="true">
                    {c.slice(0, 1).toUpperCase()}
                  </span>
                  <Link href={`/people/${encodeURIComponent(c)}`}>{c}</Link>
                </li>
              ))}
            </ul>
          </RailBlock>
          <RailBlock title="Evidence">
            <p className="rail-text">
              {attempts.length} {attempts.length === 1 ? "attempt" : "attempts"}
              , {w.tests.filter((t) => t.status === "complete").length}{" "}
              completed{" "}
              {w.tests.filter((t) => t.status === "complete").length === 1
                ? "test"
                : "tests"}
              .
              {strongest >= 3
                ? " At least one claim has verified measurements."
                : strongest >= 2
                  ? " Some claims are supported by others."
                  : " Mostly personal accounts so far."}
            </p>
          </RailBlock>
          {p.needs.length > 0 && (
            <RailBlock title="Current needs">
              <ul className="need-list">
                {p.needs.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <Link
                className="text-link"
                href={`/problems/${p.id}?tab=discussion&offer=expertise`}
              >
                I can help
              </Link>
            </RailBlock>
          )}
          <RailBlock title="Recent activity">
            <ol className="activity-mini">
              {events.slice(0, 5).map((e, i) => (
                <li key={i}>
                  <Link href={e.href}>{e.what}</Link>
                  <time dateTime={e.at}>{e.at.slice(0, 10)}</time>
                </li>
              ))}
            </ol>
          </RailBlock>
          {attempts.length >= 2 && (
            <Link
              className="rail-cta"
              href={`/analyze?ids=${attempts
                .slice(0, 4)
                .map((a) => a.id)
                .join(",")}`}
            >
              <Scale size={15} aria-hidden="true" />
              <span>
                <strong>Compare these attempts</strong>
                <small>See what differs between them</small>
              </span>
            </Link>
          )}
          {p.id === "plastic-biodegradation-scale-up" && (
            <Link className="rail-cta" href="/analyze">
              <Scale size={15} aria-hidden="true" />
              <span>
                <strong>Compare six attempts</strong>
                <small>Including runs from other labs</small>
              </span>
            </Link>
          )}
          <Link className="rail-cta" href={`/workspaces/new?problem=${p.id}`}>
            <FlaskConical size={15} aria-hidden="true" />
            <span>
              <strong>Start a workspace</strong>
              <small>Organise ideas, tasks and tests with others</small>
            </span>
          </Link>
          {p.owner && <ReportButton type="problem" id={p.id} />}
        </aside>
      </div>
    </div>
  );
}
