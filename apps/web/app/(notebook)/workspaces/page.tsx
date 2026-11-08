import type { Metadata } from "next";
import Link from "next/link";
import { Lock, Plus, Users } from "lucide-react";
import { Pill } from "@/components/knowledge";
import { currentAccount } from "@/lib/auth.server";
import { listProblems } from "@/lib/problems.server";
import { visibilityLabel } from "@/lib/workspaces";
import { listWorkspaces, myWorkspaces } from "@/lib/workspaces.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Workspaces" };

/** Where people organise work on a problem together. */
export default async function Workspaces() {
  const viewer = await currentAccount();
  const [all, mine, problems] = await Promise.all([
    listWorkspaces(viewer?.id),
    myWorkspaces(viewer),
    listProblems(),
  ]);
  const mineIds = new Set(mine.map((m) => m.id));
  return (
    <div className="frame directory">
      <header className="editorial-head">
        <div>
          <h1>Workspaces</h1>
          <p>
            Shared studios for moving from discussion to tested improvements.
          </p>
        </div>
        <Link className="button button-dark" href="/workspaces/new">
          <Plus size={15} aria-hidden="true" /> Start a workspace
        </Link>
      </header>
      <ul className="ws-grid">
        {all.map((w) => {
          const problem = problems.find((p) => p.id === w.problemId);
          const open = w.items.filter(
            (i) => i.kind === "task" && i.status !== "done",
          ).length;
          return (
            <li key={w.id}>
              <Link className="ws-card" href={`/workspaces/${w.id}`}>
                <span className="ws-top">
                  <Pill tone={w.visibility === "public" ? "ongoing" : "quiet"}>
                    {w.visibility !== "public" && (
                      <Lock size={11} aria-hidden="true" />
                    )}
                    {visibilityLabel[w.visibility]}
                  </Pill>
                  {mineIds.has(w.id) && (
                    <Pill tone="worked">You’re a member</Pill>
                  )}
                  {w.sample && <span className="example-tag">Sample</span>}
                </span>
                <strong>{w.title}</strong>
                {problem && <small>{problem.title}</small>}
                <span className="ws-stats">
                  <span>
                    <Users size={13} aria-hidden="true" />{" "}
                    {w.memberCount ?? w.members.length} members
                  </span>
                  {w.items.length > 0 && <span>{open} open tasks</span>}
                  <span>Updated {w.updated.slice(0, 10)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
