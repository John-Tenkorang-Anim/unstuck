import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PostForm } from "@/components/record-actions";
import { hasDatabase } from "@/lib/db.server";
import { getProblem, listProblems } from "@/lib/problems.server";
import { roleHelp, roleLabel, type Role } from "@/lib/workspaces";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Start a workspace" };

export default async function NewWorkspace({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const problem =
    typeof query.problem === "string"
      ? await getProblem(query.problem)
      : undefined;
  const problems = await listProblems();
  return (
    <div className="frame form-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/workspaces" className="back-link">
          <ArrowLeft size={14} /> Workspaces
        </Link>
      </nav>
      <header className="form-head">
        <p className="record-kicker">Start a workspace</p>
        <h1>Organise the work</h1>
        <p>
          Ideas, tasks, tests, evidence and decisions in one place. Start
          privately, or choose who can read the workspace before creating it.
        </p>
      </header>
      {!hasDatabase() ? (
        <div className="empty-state">
          <h3>Workspaces need a database.</h3>
        </div>
      ) : (
        <PostForm
          endpoint="/api/workspaces"
          submit="Create workspace"
          goTo="/workspaces/:id"
          className="post-form long-form"
        >
          <label className="field">
            <span>Name</span>
            <input
              name="title"
              required
              minLength={4}
              defaultValue={
                problem
                  ? `${problem.title.replace(/\?$/, "")}: working group`
                  : ""
              }
            />
          </label>
          <label className="field">
            <span>Problem</span>
            <select name="problemId" defaultValue={problem?.id ?? ""}>
              <option value="">Not linked to a problem</option>
              {problems.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>What are you trying to achieve?</span>
            <textarea name="goal" rows={3} required minLength={10} />
          </label>
          <label className="field">
            <span>Current strategy (optional)</span>
            <textarea name="strategy" rows={2} />
          </label>
          <fieldset className="licence-picker">
            <legend>Who can see it</legend>
            {(
              [
                [
                  "public",
                  "Public",
                  "Anyone can read it and join as a contributor",
                ],
                [
                  "restricted",
                  "Restricted",
                  "Anyone can find it; only people you add can see inside",
                ],
                ["private", "Private", "Only members know it exists"],
              ] as const
            ).map(([v, l, t]) => (
              <label key={v}>
                <input
                  type="radio"
                  name="visibility"
                  value={v}
                  defaultChecked={v === "private"}
                />
                <span>
                  <strong>{l}</strong>
                  <small>{t}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <dl className="facts">
            {(Object.keys(roleLabel) as Role[]).map((r) => (
              <div key={r}>
                <dt>{roleLabel[r]}</dt>
                <dd>{roleHelp[r]}</dd>
              </div>
            ))}
          </dl>
        </PostForm>
      )}
    </div>
  );
}
