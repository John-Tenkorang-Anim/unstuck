import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Target } from "lucide-react";
import { AttemptOutcome } from "@/components/knowledge";
import { PostForm } from "@/components/record-actions";
import { getEntry } from "@/lib/api";
import { hasDatabase } from "@/lib/db.server";
import { planFields } from "@/lib/improvements";
import { getProblem } from "@/lib/problems.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Propose an improvement" };

/**
 * Propose an improvement in context: the attempt or problem it builds on is
 * kept with it, so it appears in both places with the same status.
 */
export default async function NewProposal({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const entryId = typeof query.entry === "string" ? query.entry : "";
  const entry = entryId
    ? await getEntry(entryId).catch(() => undefined)
    : undefined;
  const problemId =
    entry?.problem ?? (typeof query.problem === "string" ? query.problem : "");
  const problem = problemId ? await getProblem(problemId) : undefined;
  return (
    <div className="frame form-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link
          href={
            entry
              ? `/entries/${entry.id}`
              : problem
                ? `/problems/${problem.id}`
                : "/problems"
          }
          className="back-link"
        >
          <ArrowLeft size={14} /> Back
        </Link>
      </nav>
      <header className="form-head">
        <p className="record-kicker">Propose an improvement</p>
        <h1>What should be done differently?</h1>
        <p>
          An improvement is its own contribution, credited to you. Others can
          question it, add evidence and help test it.
        </p>
      </header>
      {(entry || problem) && (
        <div className="context-card">
          <span className="label">Builds on</span>
          {entry && (
            <p>
              <Link href={`/entries/${entry.id}`}>{entry.title}</Link>{" "}
              <AttemptOutcome entry={entry} />
            </p>
          )}
          {problem && (
            <p>
              <Target size={14} aria-hidden="true" />{" "}
              <Link href={`/problems/${problem.id}`}>{problem.title}</Link>
            </p>
          )}
        </div>
      )}
      {!entry && !problem ? (
        <div className="empty-state">
          <h3>Start from an attempt or a problem.</h3>
          <p>
            Proposals stay connected to what they improve. Open one and choose
            “Build on this attempt”.
          </p>
          <Link className="button button-dark" href="/problems">
            Browse problems
          </Link>
        </div>
      ) : !hasDatabase() ? (
        <div className="empty-state">
          <h3>Proposals need a database.</h3>
          <p>Run npm run db:start and set DATABASE_URL to turn on sharing.</p>
        </div>
      ) : (
        <PostForm
          endpoint="/api/improvements"
          extra={{ entryId: entry?.id, problemId: problem?.id }}
          submit="Publish proposal"
          goTo="/improvements/:id"
          className="post-form long-form"
        >
          <label className="field">
            <span>Title</span>
            <input
              name="title"
              required
              minLength={6}
              maxLength={140}
              placeholder="For example: Improve oxygen transfer during scale-up"
            />
          </label>
          <label className="field">
            <span>Proposed change</span>
            <small>What should be done differently?</small>
            <textarea name="change" rows={3} required minLength={10} />
          </label>
          <label className="field">
            <span>Reasoning</span>
            <small>Why might this work?</small>
            <textarea name="reasoning" rows={3} required minLength={10} />
          </label>
          <label className="field">
            <span>Expected benefit</span>
            <textarea name="benefit" rows={2} />
          </label>
          <label className="field">
            <span>Potential risks and trade-offs</span>
            <textarea name="risks" rows={2} />
          </label>
          <label className="field">
            <span>Supporting evidence</span>
            <small>
              Experiences or findings that justify it. Link to records where you
              can.
            </small>
            <textarea name="evidence" rows={2} />
          </label>
          <label className="field">
            <span>Open questions</span>
            <textarea name="questions" rows={2} />
          </label>
          <details className="disclosure">
            <summary>Add a test plan (optional, you can add it later)</summary>
            {planFields.map(([k, label, hint]) => (
              <label className="field" key={k}>
                <span>{label}</span>
                <textarea name={`plan.${k}`} rows={2} placeholder={hint} />
              </label>
            ))}
          </details>
          <label className="check">
            <input type="checkbox" name="draft" data-bool />
            <span>Save as a draft only you can see</span>
          </label>
        </PostForm>
      )}
    </div>
  );
}
