import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  FlaskConical,
  HelpCircle,
  MessageSquarePlus,
  Plus,
} from "lucide-react";
import { Pill, ProposalStatus, RailBlock, Tabs } from "@/components/knowledge";
import { PostForm, RecordActions } from "@/components/record-actions";
import { ReportButton } from "@/components/report-button";
import { ResolveButton } from "@/components/resolve-button";
import { getEntry } from "@/lib/api";
import { currentAccount } from "@/lib/auth.server";
import { hasDatabase } from "@/lib/db.server";
import { isFollowing } from "@/lib/follows.server";
import {
  discussionKinds,
  eventLabel,
  lifecycle,
  needsAnswer,
  nextStatuses,
  planFields,
  statusLabel,
  verdictLabel,
  verdicts,
} from "@/lib/improvements";
import { getImprovement } from "@/lib/improvements.server";
import { getProblem } from "@/lib/problems.server";
import { testStatusLabel } from "@/lib/tests";
import { allTests } from "@/lib/tests.server";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const i = await getImprovement((await params).id);
  return { title: i?.title ?? "Proposal not found" };
}
const tabs = [
  ["overview", "Overview"],
  ["discussion", "Discussion"],
  ["plan", "Test plan"],
  ["results", "Results"],
  ["history", "History"],
] as const;
type Tab = (typeof tabs)[number][0];

/**
 * An improvement proposal: a collaborative document with a visible
 * lifecycle, structured discussion, a test plan, results and full history.
 */
export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const viewer = await currentAccount();
  const i = await getImprovement(id, viewer?.id);
  if (!i) notFound();
  const query = await searchParams;
  const tab = (tabs.find(([k]) => k === query.tab)?.[0] ?? "overview") as Tab;
  const theme = typeof query.theme === "string" ? query.theme : "";
  const [entry, problem, tests, following] = await Promise.all([
    i.entryId ? getEntry(i.entryId).catch(() => undefined) : undefined,
    i.problemId ? getProblem(i.problemId) : undefined,
    allTests().then((ts) => ts.filter((t) => t.improvementId === i.id)),
    isFollowing(viewer, "improvement", i.id),
  ]);
  const canSteer =
    !i.sample &&
    !!viewer &&
    (viewer.moderator ||
      viewer.id === i.owner ||
      (!!entry?.owner && entry.owner === viewer.id));
  const talk = i.events.filter(
    (e) =>
      discussionKinds.includes(e.kind) ||
      e.kind === "challenge" ||
      e.kind === "refinement" ||
      e.kind === "test",
  );
  const unresolved = talk.filter((e) => needsAnswer(e.kind) && !e.resolved);
  const themed = theme ? talk.filter((e) => e.kind === theme) : talk;
  const href = (k: string) =>
    `/improvements/${i.id}${k === "overview" ? "" : `?tab=${k}`}`;
  const step = lifecycle.indexOf(i.status);
  const plan = planFields.filter(([k]) => i.plan[k]);
  const credit = [i.author, ...i.collaborators].filter(
    (n) => n !== "Historical record",
  );

  return (
    <div className="frame knowledge-page proposal-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link
          href={
            problem ? `/problems/${problem.id}?tab=improvements` : "/problems"
          }
          className="back-link"
        >
          <ArrowLeft size={14} /> {problem ? problem.title : "Problems"}
        </Link>
      </nav>
      {i.sample && (
        <p className="example-notice">
          <span className="example-tag">Sample data</span> A fictional proposal,
          used to show how improvements are discussed and tested.
        </p>
      )}
      <header className="record-head">
        <p className="record-kicker">Improvement proposal</p>
        <h1>{i.title}</h1>
        <div className="record-status">
          <ProposalStatus improvement={i} />
          <span className="record-meta">
            Proposed by{" "}
            <Link href={`/people/${encodeURIComponent(i.author)}`}>
              {i.author}
            </Link>
            {i.authorRole && `, ${i.authorRole}`} · {i.created.slice(0, 10)}
          </span>
        </div>
        <p className="record-links">
          <span>Linked to</span>
          {problem && (
            <Link href={`/problems/${problem.id}`}>{problem.title}</Link>
          )}
          {entry && <Link href={`/entries/${entry.id}`}>{entry.title}</Link>}
        </p>
        <div className="record-actions-row">
          <Link
            className="button button-dark"
            href={`${href("discussion")}#contribute`}
          >
            <MessageSquarePlus size={15} /> Contribute to proposal
          </Link>
          <Link
            className="button button-outline"
            href={`/improvements/${i.id}?tab=discussion&kind=suggestion#contribute`}
          >
            Suggest change
          </Link>
          <RecordActions
            save={`improvement:${i.id}`}
            follow={{
              type: "improvement",
              id: i.id,
              following,
              enabled: hasDatabase(),
            }}
            cite={{
              title: i.title,
              author: credit.join(", ") || i.author,
              date: i.created,
              path: `/improvements/${i.id}`,
              kind: "Improvement proposal",
            }}
          />
        </div>
      </header>

      <ol className="lifecycle" aria-label="Lifecycle">
        {lifecycle.map((s, n) => (
          <li
            key={s}
            data-state={n < step ? "done" : n === step ? "current" : "next"}
            aria-current={n === step ? "step" : undefined}
          >
            <span>{statusLabel[s]}</span>
            {s === "evaluated" && i.status === "evaluated" && i.verdict && (
              <small>{verdictLabel[i.verdict]}</small>
            )}
          </li>
        ))}
      </ol>

      <Tabs
        label="Proposal"
        current={tab}
        href={href}
        tabs={tabs.map(
          ([k, l]) =>
            [
              k,
              l,
              k === "discussion"
                ? talk.length
                : k === "results"
                  ? tests.length
                  : undefined,
            ] as const,
        )}
      />

      <div className="knowledge-grid knowledge-grid-two">
        <div className="knowledge-main">
          {unresolved.length > 0 && tab !== "discussion" && (
            <Link
              className="open-issues"
              href={`${href("discussion")}#open-issues`}
            >
              <AlertTriangle size={15} aria-hidden="true" />
              {unresolved.length} open{" "}
              {unresolved.length === 1
                ? "question or concern"
                : "questions and concerns"}
            </Link>
          )}

          {tab === "overview" && (
            <div className="case">
              {(
                [
                  [
                    "Proposed change",
                    "What should be done differently?",
                    i.change,
                  ],
                  ["Reasoning", "Why might this work?", i.reasoning],
                  [
                    "Expected benefit",
                    "What improvement is anticipated?",
                    i.benefit,
                  ],
                  [
                    "Potential risks and trade-offs",
                    "What could go wrong?",
                    i.risks,
                  ],
                  [
                    "Supporting evidence",
                    "Which experiences or findings justify it?",
                    i.evidence,
                  ],
                  ["Open questions", "What remains unknown?", i.questions],
                ] as const
              ).map(([title, prompt, body]) => (
                <section key={title}>
                  <h2>{title}</h2>
                  <p className="case-prompt">{prompt}</p>
                  {body ? (
                    <p>{body}</p>
                  ) : (
                    <p className="quiet-line">Not written yet.</p>
                  )}
                </section>
              ))}
              {i.status === "evaluated" && i.results && (
                <section>
                  <h2>What testing found</h2>
                  <p>{i.results}</p>
                </section>
              )}
            </div>
          )}

          {tab === "discussion" && (
            <section className="prose-block">
              {unresolved.length > 0 && (
                <div id="open-issues" className="issues">
                  <h2>Open questions and concerns</h2>
                  <ul>
                    {unresolved.map((e) => (
                      <li key={e.id}>
                        {e.kind === "question" ? (
                          <HelpCircle size={15} aria-hidden="true" />
                        ) : (
                          <AlertTriangle size={15} aria-hidden="true" />
                        )}
                        <div>
                          <p>{e.body}</p>
                          <p className="record-meta">
                            {e.actor} · {e.created.slice(0, 10)}
                          </p>
                        </div>
                        {!i.sample && viewer && (
                          <ResolveButton
                            improvement={i.id}
                            event={e.id}
                            resolved={false}
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="block-head">
                <h2>Discussion</h2>
                <nav className="seg" aria-label="Themes">
                  <Link
                    href={`${href("discussion")}`}
                    aria-current={!theme ? "true" : undefined}
                  >
                    All
                  </Link>
                  {discussionKinds
                    .filter((k) => talk.some((e) => e.kind === k))
                    .map((k) => (
                      <Link
                        key={k}
                        href={`${href("discussion")}&theme=${k}`}
                        aria-current={theme === k ? "true" : undefined}
                      >
                        {eventLabel[k]}
                      </Link>
                    ))}
                </nav>
              </div>
              {themed.length === 0 && (
                <p className="quiet-line">
                  No contributions yet. Start the discussion below.
                </p>
              )}
              <ol className="thread">
                {themed.map((e) => (
                  <li key={e.id} data-kind={e.kind}>
                    <span className="avatar" aria-hidden="true">
                      {e.actor.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <p className="thread-meta">
                        <b>{e.actor}</b>
                        <span className="kind-tag" data-kind={e.kind}>
                          {eventLabel[e.kind]}
                        </span>
                        <time dateTime={e.created}>
                          {e.created.slice(0, 10)}
                        </time>
                        {needsAnswer(e.kind) && e.resolved && (
                          <Pill tone="worked">Answered</Pill>
                        )}
                      </p>
                      <p>{e.body}</p>
                      {!i.sample &&
                        viewer &&
                        needsAnswer(e.kind) &&
                        e.resolved && (
                          <ResolveButton
                            improvement={i.id}
                            event={e.id}
                            resolved
                          />
                        )}
                    </div>
                  </li>
                ))}
              </ol>
              <div id="contribute">
                {i.sample ? (
                  <p className="aside-note">
                    This is sample data, so it can’t take new contributions.
                    Propose an improvement on a real attempt to start a
                    discussion.
                  </p>
                ) : (
                  <PostForm
                    endpoint={`/api/improvements/${i.id}`}
                    submit="Add to discussion"
                    done="Added."
                  >
                    <fieldset className="kind-picker">
                      <legend>What are you adding?</legend>
                      {discussionKinds.map((k, n) => (
                        <label key={k}>
                          <input
                            type="radio"
                            name="kind"
                            value={k}
                            defaultChecked={
                              query.kind ? query.kind === k : n === 0
                            }
                          />
                          <span>{eventLabel[k]}</span>
                        </label>
                      ))}
                    </fieldset>
                    <label className="field">
                      <span className="sr-only">Your contribution</span>
                      <textarea
                        name="body"
                        rows={4}
                        required
                        placeholder="Be specific. Refer to a section, a piece of evidence or a step in the plan."
                      />
                    </label>
                  </PostForm>
                )}
              </div>
            </section>
          )}

          {tab === "plan" && (
            <section className="prose-block">
              <h2>Test plan</h2>
              {plan.length ? (
                <dl className="facts plan">
                  {plan.map(([k, label]) => (
                    <div key={k}>
                      <dt>{label}</dt>
                      <dd>{i.plan[k]}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="quiet-line">No test plan yet.</p>
              )}
              {canSteer && (
                <details className="disclosure">
                  <summary>Revise the test plan</summary>
                  <PostForm
                    endpoint={`/api/improvements/${i.id}`}
                    extra={{ action: "revise", note: "Revised the test plan" }}
                    submit="Save plan"
                    done="Plan saved."
                  >
                    {planFields.map(([k, label, hint]) => (
                      <label className="field" key={k}>
                        <span>{label}</span>
                        <textarea
                          name={`plan.${k}`}
                          rows={2}
                          defaultValue={i.plan[k]}
                          placeholder={hint}
                        />
                      </label>
                    ))}
                  </PostForm>
                </details>
              )}
            </section>
          )}

          {tab === "results" && (
            <section className="prose-block">
              <div className="block-head">
                <h2>Results</h2>
                {!i.sample && (
                  <Link
                    className="button button-dark"
                    href={`/tests/new?improvement=${i.id}`}
                  >
                    <Plus size={15} /> Plan a test
                  </Link>
                )}
              </div>
              <p className="quiet-line">
                A proposal can have several tests, and they can disagree. Each
                says how confident its findings are.
              </p>
              {tests.length === 0 && (
                <p className="quiet-line">No tests yet.</p>
              )}
              <ul className="proposal-list">
                {tests.map((t) => (
                  <li key={t.id} className="proposal-row">
                    <div className="attempt-top">
                      <Pill
                        tone={
                          t.status === "complete"
                            ? "worked"
                            : t.status === "running"
                              ? "ongoing"
                              : "quiet"
                        }
                      >
                        {testStatusLabel[t.status]}
                      </Pill>
                      {t.findings?.verdict && (
                        <Pill
                          tone={
                            t.findings.verdict === "supported"
                              ? "worked"
                              : t.findings.verdict === "not_supported"
                                ? "failed"
                                : "mixed"
                          }
                        >
                          {verdictLabel[t.findings.verdict]}
                        </Pill>
                      )}
                    </div>
                    <h3>
                      <FlaskConical size={15} aria-hidden="true" />{" "}
                      <Link href={`/tests/${t.id}`}>{t.title}</Link>
                    </h3>
                    <p>
                      {t.findings?.happened ??
                        t.results.summary ??
                        t.plan.objective}
                    </p>
                    {t.findings && (
                      <p className="record-meta">
                        {t.findings.confidence} confidence ·{" "}
                        {t.findings.limitations}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              {i.results && (
                <>
                  <h3 className="sub-head">Summary from the proposer</h3>
                  <p>{i.results}</p>
                </>
              )}
            </section>
          )}

          {tab === "history" && (
            <section className="prose-block">
              <h2>History</h2>
              <ol className="history">
                {[...i.events].reverse().map((e) => (
                  <li key={e.id}>
                    <time dateTime={e.created}>{e.created.slice(0, 10)}</time>
                    <span>
                      <b>{e.actor}</b>{" "}
                      {e.kind === "created"
                        ? "proposed it"
                        : e.kind === "status"
                          ? `moved it to ${e.to ? statusLabel[e.to] : "a new stage"}`
                          : e.kind === "revision"
                            ? e.body || "revised it"
                            : `added a ${eventLabel[e.kind].toLowerCase()}`}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <aside className="knowledge-rail">
          {canSteer && nextStatuses[i.status].length > 0 && (
            <RailBlock title="Move it forward">
              <PostForm
                endpoint={`/api/improvements/${i.id}`}
                extra={{ action: "status" }}
                submit="Update status"
                done="Status updated."
                className="steer"
              >
                <label className="field">
                  <span>Next stage</span>
                  <select name="status">
                    {nextStatuses[i.status].map((s) => (
                      <option key={s} value={s}>
                        {statusLabel[s]}
                      </option>
                    ))}
                  </select>
                </label>
                {nextStatuses[i.status].includes("evaluated") && (
                  <>
                    <label className="field">
                      <span>If evaluating: what did testing find?</span>
                      <select name="verdict" defaultValue="">
                        <option value="">Choose a verdict</option>
                        {verdicts.map((v) => (
                          <option key={v} value={v}>
                            {verdictLabel[v]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Summary of results</span>
                      <textarea name="results" rows={3} />
                    </label>
                  </>
                )}
                <label className="field">
                  <span>Note (optional)</span>
                  <input name="note" />
                </label>
              </PostForm>
            </RailBlock>
          )}
          <RailBlock title="Contributors">
            <ul className="people">
              {credit.map((c, n) => (
                <li key={c}>
                  <span className="avatar" aria-hidden="true">
                    {c.slice(0, 1).toUpperCase()}
                  </span>
                  <Link href={`/people/${encodeURIComponent(c)}`}>{c}</Link>
                  <small>{n === 0 ? "Proposer" : "Collaborator"}</small>
                </li>
              ))}
            </ul>
          </RailBlock>
          <RailBlock title="Where it stands">
            <p className="rail-text">
              {statusLabel[i.status]}
              {i.verdict && i.status === "evaluated"
                ? `: ${verdictLabel[i.verdict].toLowerCase()}`
                : ""}
              . {tests.length} {tests.length === 1 ? "test" : "tests"},{" "}
              {unresolved.length} open{" "}
              {unresolved.length === 1 ? "issue" : "issues"}.
            </p>
            <p className="rail-text quiet-line">
              Updated {i.updated.slice(0, 10)}
            </p>
          </RailBlock>
          {!i.sample && <ReportButton type="improvement" id={i.id} />}
        </aside>
      </div>
    </div>
  );
}
