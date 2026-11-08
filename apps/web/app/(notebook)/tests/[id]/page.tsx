import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Minus, X } from "lucide-react";
import { Pill, RailBlock, Tabs } from "@/components/knowledge";
import { CiteAction, PostForm } from "@/components/record-actions";
import { currentAccount } from "@/lib/auth.server";
import { planFields, verdictLabel, verdicts } from "@/lib/improvements";
import { getImprovement } from "@/lib/improvements.server";
import { getProblem } from "@/lib/problems.server";
import { testStatusLabel } from "@/lib/tests";
import { getTest } from "@/lib/tests.server";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const t = await getTest((await params).id);
  return { title: t?.title ?? "Test not found" };
}
const tabs = [
  ["plan", "Plan"],
  ["runs", "Runs"],
  ["results", "Results"],
  ["findings", "Findings"],
] as const;
type Tab = (typeof tabs)[number][0];

/** A test, laid out like an experiment notebook: plan, runs, results, findings. */
export default async function TestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTest((await params).id);
  if (!t) notFound();
  const query = await searchParams;
  const tab = (tabs.find(([k]) => k === query.tab)?.[0] ?? "plan") as Tab;
  const viewer = await currentAccount();
  const [improvement, problem] = await Promise.all([
    t.improvementId ? getImprovement(t.improvementId, viewer?.id) : undefined,
    t.problemId ? getProblem(t.problemId) : undefined,
  ]);
  const mine =
    !t.sample && !!viewer && (viewer.id === t.owner || viewer.moderator);
  const href = (k: string) =>
    `/tests/${t.id}${k === "plan" ? "" : `?tab=${k}`}`;
  return (
    <div className="frame knowledge-page test-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link
          href={
            improvement
              ? `/improvements/${improvement.id}?tab=results`
              : problem
                ? `/problems/${problem.id}?tab=tests`
                : "/problems"
          }
          className="back-link"
        >
          <ArrowLeft size={14} />{" "}
          {improvement?.title ?? problem?.title ?? "Problems"}
        </Link>
      </nav>
      {t.sample && (
        <p className="example-notice">
          <span className="example-tag">Sample data</span> A fictional test
          record.
        </p>
      )}
      <header className="record-head">
        <p className="record-kicker">Test</p>
        <h1>{t.title}</h1>
        <div className="record-status">
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
          <span className="record-meta">
            Run by{" "}
            <Link href={`/people/${encodeURIComponent(t.author)}`}>
              {t.author}
            </Link>{" "}
            · started {t.created.slice(0, 10)}
          </span>
        </div>
        {improvement && (
          <p className="record-links">
            <span>Evaluates</span>
            <Link href={`/improvements/${improvement.id}`}>
              {improvement.title}
            </Link>
          </p>
        )}
        <div className="record-actions-row">
          <CiteAction
            cite={{
              title: t.title,
              author: t.author,
              date: t.created,
              path: `/tests/${t.id}`,
              kind: "Test",
            }}
          />
        </div>
      </header>
      <Tabs
        label="Test"
        current={tab}
        href={href}
        tabs={tabs.map(
          ([k, l]) => [k, l, k === "runs" ? t.runs.length : undefined] as const,
        )}
      />
      <div className="knowledge-grid knowledge-grid-two">
        <div className="knowledge-main notebook-sheet">
          {tab === "plan" && (
            <section className="prose-block">
              <h2>Plan</h2>
              <dl className="facts plan">
                {planFields
                  .filter(([k]) => t.plan[k])
                  .map(([k, label]) => (
                    <div key={k}>
                      <dt>{label}</dt>
                      <dd>{t.plan[k]}</dd>
                    </div>
                  ))}
              </dl>
              {t.conditions.length > 0 && (
                <>
                  <h3 className="sub-head">Conditions</h3>
                  <ul className="dash-list">
                    {t.conditions.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}
          {tab === "runs" && (
            <section className="prose-block">
              <h2>Runs</h2>
              {t.runs.length === 0 ? (
                <p className="quiet-line">No runs recorded yet.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Conditions</th>
                        <th scope="col">Measurement or observation</th>
                        <th scope="col">Deviation from plan</th>
                        <th scope="col">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.runs.map((r, n) => (
                        <tr key={n}>
                          <td>{r.date}</td>
                          <td>{r.conditions || "—"}</td>
                          <td>{r.measurement}</td>
                          <td>{r.deviation || "None"}</td>
                          <td>{r.by}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {mine && (
                <details className="disclosure" open={t.runs.length === 0}>
                  <summary>Record a run</summary>
                  <PostForm
                    endpoint={`/api/tests/${t.id}`}
                    extra={{ action: "run" }}
                    submit="Add run"
                    done="Run recorded."
                  >
                    <div className="field-row">
                      <label className="field">
                        <span>Date</span>
                        <input type="date" name="date" />
                      </label>
                      <label className="field">
                        <span>Conditions</span>
                        <input
                          name="conditions"
                          placeholder="Weather, scale, location…"
                        />
                      </label>
                    </div>
                    <label className="field">
                      <span>What you measured or saw</span>
                      <textarea name="measurement" rows={2} required />
                    </label>
                    <label className="field">
                      <span>Anything different from the plan?</span>
                      <input name="deviation" />
                    </label>
                  </PostForm>
                </details>
              )}
            </section>
          )}
          {tab === "results" && (
            <section className="prose-block">
              <h2>Results</h2>
              {t.results.summary && <p>{t.results.summary}</p>}
              {t.results.rows.length > 0 ? (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th scope="col">Measure</th>
                        <th scope="col">Success criterion</th>
                        <th scope="col">Observed</th>
                        <th scope="col">Met?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.results.rows.map((r, n) => (
                        <tr key={n}>
                          <th scope="row">{r.measure}</th>
                          <td>{r.criterion}</td>
                          <td>{r.observed}</td>
                          <td className="met" data-met={String(r.met)}>
                            {r.met === true ? (
                              <>
                                <Check size={14} aria-hidden="true" /> Yes
                              </>
                            ) : r.met === false ? (
                              <>
                                <X size={14} aria-hidden="true" /> No
                              </>
                            ) : (
                              <>
                                <Minus size={14} aria-hidden="true" /> Can’t say
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="quiet-line">
                  No results yet. They’re shown against the plan’s success
                  criteria: {t.plan.success || "not set"}.
                </p>
              )}
              {mine && (
                <details className="disclosure">
                  <summary>Record results</summary>
                  <PostForm
                    endpoint={`/api/tests/${t.id}`}
                    extra={{ action: "results" }}
                    submit="Save results"
                    done="Results saved."
                  >
                    <label className="field">
                      <span>Summary</span>
                      <textarea
                        name="summary"
                        rows={2}
                        defaultValue={t.results.summary}
                      />
                    </label>
                    <div className="table-wrap">
                      <table className="data-table form-table">
                        <thead>
                          <tr>
                            <th scope="col">Measure</th>
                            <th scope="col">Success criterion</th>
                            <th scope="col">Observed</th>
                            <th scope="col">Met?</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[0, 1, 2, 3].map((n) => {
                            const r = t.results.rows[n];
                            return (
                              <tr key={n}>
                                <td>
                                  <input
                                    aria-label={`Measure ${n + 1}`}
                                    name={`rows[${n}].measure`}
                                    defaultValue={r?.measure}
                                  />
                                </td>
                                <td>
                                  <input
                                    aria-label={`Criterion ${n + 1}`}
                                    name={`rows[${n}].criterion`}
                                    defaultValue={
                                      r?.criterion ??
                                      (n === 0 ? t.plan.success : "")
                                    }
                                  />
                                </td>
                                <td>
                                  <input
                                    aria-label={`Observed ${n + 1}`}
                                    name={`rows[${n}].observed`}
                                    defaultValue={r?.observed}
                                  />
                                </td>
                                <td>
                                  <select
                                    aria-label={`Met ${n + 1}`}
                                    name={`rows[${n}].met`}
                                    defaultValue={r ? String(r.met) : "null"}
                                  >
                                    <option value="null">Can’t say</option>
                                    <option value="true">Yes</option>
                                    <option value="false">No</option>
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="quiet-line">
                      Leave a row’s measure empty to skip it. Use the findings
                      to say what the results mean.
                    </p>
                  </PostForm>
                </details>
              )}
            </section>
          )}
          {tab === "findings" && (
            <section className="prose-block">
              <h2>Findings</h2>
              {t.findings ? (
                <dl className="facts">
                  <div>
                    <dt>What happened?</dt>
                    <dd>{t.findings.happened}</dd>
                  </div>
                  <div>
                    <dt>Was the improvement supported?</dt>
                    <dd>
                      {t.findings.verdict
                        ? verdictLabel[t.findings.verdict]
                        : "No verdict given"}
                    </dd>
                  </div>
                  <div>
                    <dt>How confident are the findings?</dt>
                    <dd>
                      {t.findings.confidence[0].toUpperCase() +
                        t.findings.confidence.slice(1)}{" "}
                      confidence
                    </dd>
                  </div>
                  <div>
                    <dt>What limitations remain?</dt>
                    <dd>{t.findings.limitations || "None recorded"}</dd>
                  </div>
                  <div>
                    <dt>Retest or revise?</dt>
                    <dd>{t.findings.next || "Not decided"}</dd>
                  </div>
                </dl>
              ) : (
                <p className="quiet-line">
                  No findings yet. They’re written once the runs are done.
                </p>
              )}
              {mine && (
                <details
                  className="disclosure"
                  open={!t.findings && t.runs.length > 0}
                >
                  <summary>
                    {t.findings ? "Revise findings" : "Write findings"}
                  </summary>
                  <PostForm
                    endpoint={`/api/tests/${t.id}`}
                    extra={{ action: "findings" }}
                    submit="Publish findings"
                    done="Findings published."
                  >
                    <label className="field">
                      <span>What happened?</span>
                      <textarea name="happened" rows={3} required />
                    </label>
                    <div className="field-row">
                      <label className="field">
                        <span>Was it supported?</span>
                        <select name="verdict" defaultValue="">
                          <option value="">Can’t say yet</option>
                          {verdicts.map((v) => (
                            <option key={v} value={v}>
                              {verdictLabel[v]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span>Confidence</span>
                        <select name="confidence" defaultValue="low">
                          <option value="low">Low</option>
                          <option value="moderate">Moderate</option>
                          <option value="high">High</option>
                        </select>
                      </label>
                    </div>
                    <label className="field">
                      <span>Limitations</span>
                      <textarea name="limitations" rows={2} />
                    </label>
                    <label className="field">
                      <span>Retest or revise?</span>
                      <input name="next" />
                    </label>
                  </PostForm>
                </details>
              )}
            </section>
          )}
        </div>
        <aside className="knowledge-rail">
          <RailBlock title="Success looks like">
            <p className="rail-text">{t.plan.success || "Not set"}</p>
          </RailBlock>
          {problem && (
            <RailBlock title="Problem">
              <Link className="rail-link" href={`/problems/${problem.id}`}>
                {problem.title}
              </Link>
            </RailBlock>
          )}
          <RailBlock title="Method detail">
            <p className="rail-text">
              Statistics are optional. Record what you saw honestly, including
              deviations, and say how sure you are.
            </p>
          </RailBlock>
        </aside>
      </div>
    </div>
  );
}
