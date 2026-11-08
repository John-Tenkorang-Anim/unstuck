import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProposalStatus } from "@/components/knowledge";
import { PostForm } from "@/components/record-actions";
import { currentAccount } from "@/lib/auth.server";
import { hasDatabase } from "@/lib/db.server";
import { planFields } from "@/lib/improvements";
import { getImprovement } from "@/lib/improvements.server";
import { getProblem } from "@/lib/problems.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plan a test" };

/** Start a test record. Detail is optional: a shop owner and a lab both fit. */
export default async function NewTest({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const viewer = await currentAccount();
  const improvement =
    typeof query.improvement === "string"
      ? await getImprovement(query.improvement, viewer?.id)
      : undefined;
  const problem =
    !improvement && typeof query.problem === "string"
      ? await getProblem(query.problem)
      : improvement?.problemId
        ? await getProblem(improvement.problemId)
        : undefined;
  return (
    <div className="frame form-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link
          href={
            improvement
              ? `/improvements/${improvement.id}?tab=results`
              : "/problems"
          }
          className="back-link"
        >
          <ArrowLeft size={14} /> Back
        </Link>
      </nav>
      <header className="form-head">
        <p className="record-kicker">Plan a test</p>
        <h1>How will you find out if it works?</h1>
        <p>
          Write down what success looks like before you start. You can add runs
          and results as you go.
        </p>
      </header>
      {improvement && (
        <div className="context-card">
          <span className="label">Evaluates</span>
          <p>
            <Link href={`/improvements/${improvement.id}`}>
              {improvement.title}
            </Link>{" "}
            <ProposalStatus improvement={improvement} />
          </p>
        </div>
      )}
      {!improvement && !problem ? (
        <div className="empty-state">
          <h3>Tests start from a proposal.</h3>
          <p>That keeps every result connected to what it evaluates.</p>
          <Link className="button button-dark" href="/problems">
            Browse problems
          </Link>
        </div>
      ) : improvement?.sample ? (
        <div className="empty-state">
          <h3>This proposal is sample data.</h3>
          <p>Propose an improvement on a real attempt to plan a test.</p>
        </div>
      ) : !hasDatabase() ? (
        <div className="empty-state">
          <h3>Tests need a database.</h3>
        </div>
      ) : (
        <PostForm
          endpoint="/api/tests"
          extra={{ improvementId: improvement?.id, problemId: problem?.id }}
          submit="Create test"
          goTo="/tests/:id"
          className="post-form long-form"
        >
          <label className="field">
            <span>Title</span>
            <input
              name="title"
              required
              minLength={4}
              placeholder="For example: One month on half the routes"
            />
          </label>
          {planFields.map(([k, label, hint]) => (
            <label className="field" key={k}>
              <span>
                {label}
                {k === "objective" ? "" : " (optional)"}
              </span>
              <textarea
                name={`plan.${k}`}
                rows={2}
                required={k === "objective"}
                placeholder={hint}
                defaultValue={improvement?.plan[k] ?? ""}
              />
            </label>
          ))}
          <label className="field">
            <span>Conditions (optional)</span>
            <small>
              One per line, such as scale, temperature, season or location.
            </small>
            <textarea name="conditions" rows={3} />
          </label>
        </PostForm>
      )}
    </div>
  );
}
