import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HelpForm } from "@/components/help-actions";
import { getEntry } from "@/lib/api";
import { listCommunities } from "@/lib/communities.server";
import { hasDatabase } from "@/lib/db.server";
import { audiences, helpKinds, type Audience, type HelpKind } from "@/lib/help";
import { getProblem, listProblems } from "@/lib/problems.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ask for help" };

export default async function AskForHelp({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (k: string) =>
    typeof params[k] === "string" ? (params[k] as string) : undefined;
  const entry = one("entry")
    ? await getEntry(one("entry")!).catch(() => undefined)
    : undefined;
  const problemId = one("problem") ?? entry?.problem;
  const [problems, communities, problem] = await Promise.all([
    listProblems(),
    listCommunities().catch(() => []),
    problemId ? getProblem(problemId) : undefined,
  ]);
  return (
    <div className="frame form-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/help" className="back-link">
          <ArrowLeft size={14} /> Get help
        </Link>
      </nav>
      <header className="form-head">
        <h1>Ask for help</h1>
        <p>
          It goes to people who’ve been somewhere similar. Most of it is
          optional.
        </p>
      </header>
      {entry && (
        <div className="context-card">
          <span className="label">About</span>
          <p>
            <Link href={`/entries/${entry.id}`}>{entry.title}</Link>
          </p>
        </div>
      )}
      <HelpForm
        enabled={hasDatabase()}
        problems={problems
          .filter((p) => !p.archived)
          .map((p) => ({ id: p.id, title: p.title }))}
        categories={communities.map((c) => c.name)}
        initial={{
          audience: audiences.find((a) => a.key === one("as"))?.key as
            Audience | undefined,
          kind: helpKinds.find((k) => k.key === one("kind"))?.key as
            HelpKind | undefined,
          problemId: problem?.id,
          entryId: entry?.id,
          title: one("q"),
          category: problem?.category ?? entry?.topic,
        }}
      />
    </div>
  );
}
