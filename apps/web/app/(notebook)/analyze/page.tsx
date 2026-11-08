import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Info } from "lucide-react";
import { showExamples } from "@/lib/db.server";
import { getEntry, getNotebook } from "@/lib/api";
import {
  comparisonSets,
  evidenceText,
  factorPatterns,
  insights,
  resultText,
  type Attempt,
  type ComparisonSet,
  type EvidenceKind,
  type Result,
} from "@/lib/analysis";
import { evidenceOf, outcomeOf } from "@/lib/outcome";
import type { Entry } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Compare & analyze" };

const tabs = [
  ["compare", "Compare attempts"],
  ["factors", "Common failure factors"],
  ["confidence", "Evidence and confidence"],
  ["insights", "Insights"],
] as const;
type Tab = (typeof tabs)[number][0];

/** Turn chosen experiences into a comparison set, using their recorded conditions. */
function setFromEntries(entries: Entry[]): ComparisonSet {
  const factors = [
    ...new Set(entries.flatMap((e) => Object.keys(e.context))),
  ].slice(0, 8);
  const result = (e: Entry): Result => {
    const k = outcomeOf(e);
    return k === "worked"
      ? "succeeded"
      : k === "partial"
        ? "partial"
        : k === "failed"
          ? "failed"
          : "unknown";
  };
  const evidence = (e: Entry): EvidenceKind => {
    const level = evidenceOf(e).level;
    return level >= 3 ? "verified" : level >= 1 ? "measured" : "personal";
  };
  return {
    slug: "custom",
    title: "Comparing the experiences you chose",
    question:
      "What separates the attempts that worked from the ones that didn’t?",
    measureLabel: "Result",
    factors,
    attempts: entries.map((e, i) => ({
      id: String.fromCharCode(65 + i),
      label: `Attempt ${String.fromCharCode(65 + i)}`,
      title: e.title,
      entryId: e.id,
      values: e.context,
      result: result(e),
      evidence: evidence(e),
      by: e.alias,
    })),
  };
}

/**
 * Compare & Analyze: attempts side by side, the factors that separate failure
 * from success, how much evidence stands behind each, and insights that cite
 * their sources and say whether they are observations, hypotheses or verified.
 */
export default async function Analyze({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (k: string) => (typeof params[k] === "string" ? params[k] : "");
  const tab: Tab = tabs.find(([k]) => k === one("tab"))?.[0] ?? "compare";
  // Each picker sends `ids`; a shared link sends them comma-separated.
  const raw = params.ids;
  const ids = [
    ...new Set(
      (Array.isArray(raw) ? raw : [raw ?? ""])
        .flatMap((v) => String(v).split(","))
        .filter(Boolean),
    ),
  ].slice(0, 4);
  const notebook = await getNotebook();
  let set: ComparisonSet;
  if (ids.length) {
    const entries = (await Promise.all(ids.map((id) => getEntry(id)))).filter(
      (e): e is Entry => !!e,
    );
    set = setFromEntries(entries);
  } else set = showExamples() ? comparisonSets[0] : setFromEntries([]);
  const patterns = factorPatterns(set);
  const found = insights(set);
  const link = (change: Record<string, string>) => {
    const next = new URLSearchParams({
      ...(ids.length ? { ids: ids.join(",") } : {}),
      ...(tab !== "compare" ? { tab } : {}),
      ...change,
    });
    for (const [k, v] of [...next]) if (!v) next.delete(k);
    return `/analyze${next.size ? `?${next}` : ""}`;
  };
  const label = (id: string) =>
    set.attempts.find((a) => a.id === id)?.label ?? id;
  return (
    <div className="frame analyze">
      <header className="page-intro">
        <div>
          <p className="label">Compare & analyze</p>
          <h1>{set.title}</h1>
          <p>{set.question}</p>
        </div>
      </header>

      <form className="an-pick" action="/analyze">
        <span>Compare your own selection</span>
        {[0, 1, 2].map((i) => (
          <select
            key={i}
            name="ids"
            defaultValue={ids[i] ?? ""}
            aria-label={`Experience ${i + 1}`}
          >
            <option value="">
              {i < 2 ? "Choose an experience" : "Optional third"}
            </option>
            {notebook.entries.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
        ))}
        <button className="button button-dark">Compare</button>
        {ids.length > 0 && (
          <Link className="text-link" href="/analyze">
            {showExamples() ? "View the sample" : "Clear selection"}
          </Link>
        )}
      </form>

      {set.attempts.length < 2 && (
        <p className="empty-state">
          Choose at least two published experiences to compare. Missing or
          unavailable records are left out.
        </p>
      )}
      <nav className="an-tabs" aria-label="Analysis">
        {tabs.map(([key, text]) => (
          <Link
            key={key}
            href={link({ tab: key === "compare" ? "" : key })}
            aria-current={tab === key ? "page" : undefined}
          >
            {text}
          </Link>
        ))}
      </nav>

      {set.sample && (
        <p className="example-notice">
          <span className="example-tag">Sample data</span> A fictional set of
          attempts, used to show how comparison works.
        </p>
      )}

      {tab === "compare" && set.attempts.length >= 2 && (
        <div className="an-table-wrap">
          <table className="an-table">
            <thead>
              <tr>
                <th scope="col">Factor</th>
                {set.attempts.map((a) => (
                  <th scope="col" key={a.id}>
                    <AttemptHead attempt={a} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {set.factors.map((f) => {
                const values = set.attempts.map((a) => a.values[f] ?? "—");
                const differs = new Set(values).size > 1;
                return (
                  <tr key={f} data-differs={differs || undefined}>
                    <th scope="row">{f}</th>
                    {values.map((v, i) => (
                      <td key={i}>{v}</td>
                    ))}
                  </tr>
                );
              })}
              {set.attempts.some((a) => a.measure !== undefined) &&
                set.slug !== "custom" && (
                  <tr>
                    <th scope="row">{set.measureLabel}</th>
                    {set.attempts.map((a) => (
                      <td key={a.id} className="an-num">
                        {a.measure === undefined
                          ? "Not recorded"
                          : `~${a.measure}${set.measureUnit ?? ""}`}
                      </td>
                    ))}
                  </tr>
                )}
              <tr>
                <th scope="row">Outcome</th>
                {set.attempts.map((a) => (
                  <td key={a.id}>
                    <span className="an-result" data-result={a.result}>
                      {resultText[a.result]}
                    </span>
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Evidence</th>
                {set.attempts.map((a) => (
                  <td key={a.id} className="an-evidence">
                    {evidenceText[a.evidence]}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="an-note">
            Rows where the attempts differ are highlighted.
          </p>
        </div>
      )}

      {tab === "factors" && !patterns.length && (
        <p className="empty-state">
          No conditions were recorded for this selection. Add conditions to an
          experience to make comparisons useful.
        </p>
      )}
      {tab === "factors" && (
        <ol className="an-factors">
          {patterns.map((p) => (
            <li key={p.factor} className="an-factor">
              <div className="an-factor-head">
                <h3>{p.factor}</h3>
                <span
                  className="an-strength"
                  data-strong={p.separation >= 0.8 || undefined}
                >
                  {p.separation >= 0.8
                    ? "Separates failures from successes"
                    : p.separation > 0
                      ? "Partly separates them"
                      : "Doesn’t separate them"}
                </span>
              </div>
              <div className="an-bars">
                {p.values.map((v) => (
                  <div key={v.value} className="an-bar">
                    <span className="an-bar-label">{v.value}</span>
                    <span className="an-bar-track" aria-hidden="true">
                      {v.attempts.map((a) => (
                        <i
                          key={a.id}
                          data-result={a.result}
                          title={`${a.label}: ${resultText[a.result]}`}
                        />
                      ))}
                    </span>
                    <span className="an-bar-text">
                      {v.failed} failed · {v.succeeded} succeeded ·{" "}
                      {v.attempts.length - v.failed - v.succeeded} partial or
                      incomplete · {v.attempts.map((a) => a.id).join(", ")}
                    </span>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}

      {tab === "confidence" && (
        <div className="an-confidence">
          <ul>
            {set.attempts.map((a) => (
              <li key={a.id}>
                <span className="an-ev" data-kind={a.evidence}>
                  {evidenceText[a.evidence]}
                </span>
                <AttemptHead attempt={a} />
              </li>
            ))}
          </ul>
          <aside className="an-explain">
            <Info size={16} aria-hidden="true" />
            <p>
              <b>What each label means.</b> Verified: the measurements were
              checked, for example logs or instrument data. Independently
              replicated: someone else repeated it and got a similar result.
              Measured data: numbers from the person who ran it. Personal
              account: what someone saw, without measurements. A label describes
              what was checked, never how credible someone seems.
            </p>
          </aside>
        </div>
      )}

      {tab === "insights" && (
        <div className="an-insights">
          <p className="an-note">
            Computed from the records on this page, not written by a language
            model. Each line names the attempts it rests on.
          </p>
          {!found.length && (
            <p className="empty-state">
              No associations to report. Compare completed attempts with
              recorded conditions.
            </p>
          )}
          <ul>
            {found.map((i, n) => (
              <li key={n} className="an-insight" data-kind={i.kind}>
                <span className="an-kind">
                  {i.kind === "verified"
                    ? "Verified"
                    : i.kind === "hypothesis"
                      ? "Hypothesis"
                      : "Observation"}
                  <small>{i.confidence} confidence</small>
                </span>
                <p>{i.text}</p>
                <p className="an-refs">
                  Based on {i.refs.map(label).join(", ")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AttemptHead({ attempt: a }: { attempt: Attempt }) {
  const href = a.improvementId
    ? `/improvements/${a.improvementId}`
    : a.entryId
      ? `/entries/${a.entryId}`
      : undefined;
  return (
    <span className="an-head">
      <b>{a.label}</b>
      {href ? (
        <Link href={href}>
          {a.title} <ArrowUpRight size={12} aria-hidden="true" />
        </Link>
      ) : (
        <span>{a.title}</span>
      )}
      <small>{a.by}</small>
    </span>
  );
}
