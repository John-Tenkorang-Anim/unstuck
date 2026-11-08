import type { Metadata } from "next";
import { Contribute, type Choice } from "@/components/contribute";
import { getEntry } from "@/lib/api";
import { currentAccount } from "@/lib/auth.server";
import { joinedSlugs, listCommunities } from "@/lib/communities.server";
import { hasDatabase } from "@/lib/db.server";
import { getDraft } from "@/lib/drafts.server";
import { allImprovements } from "@/lib/improvements.server";
import { getProblem, listProblems } from "@/lib/problems.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contribute" };

const choices: Choice[] = ["attempt", "problem", "idea", "test"];
// Older links asked for a kind; send them to the matching choice.
const fromKind: Record<string, Choice> = {
  experience: "attempt",
  solution: "attempt",
  research: "attempt",
  discovery: "attempt",
  problem: "problem",
  idea: "idea",
};

export default async function New({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;
  const account = hasDatabase() ? await currentAccount() : undefined;
  const [communities, joined, problems, proposals] = await Promise.all([
    listCommunities(),
    joinedSlugs(account),
    listProblems(),
    allImprovements(200),
  ]);
  const repeat = one("repeat")
    ? await getEntry(one("repeat")!)
    : undefined;
  const relates = one("relates")
    ? await getEntry(one("relates")!)
    : undefined;
  const problemId = one("problem") ?? repeat?.problem ?? relates?.problem;
  const problem = problemId ? await getProblem(problemId) : undefined;
  const draft =
    account && one("draft")
      ? await getDraft(account, one("draft")!)
      : undefined;
  const type = one("type") as Choice | undefined;
  const community = communities.find((c) => c.slug === one("community"));
  return (
    <Contribute
      database={hasDatabase()}
      problems={problems
        .filter((p) => !p.archived)
        .map((p) => ({
          id: p.id,
          title: p.title,
          category: p.category,
          summary: p.summary,
        }))}
      proposals={proposals
        .filter(
          (i) => !i.sample && (i.status === "ready" || i.status === "testing"),
        )
        .map((i) => ({
          id: i.id,
          title: i.title,
          problem: problems.find((p) => p.id === i.problemId)?.title,
        }))}
      communities={communities}
      joined={joined}
      serverDraft={draft ? { id: draft.id, data: draft.data } : undefined}
      initial={{
        choice:
          type && choices.includes(type)
            ? type
            : one("kind")
              ? fromKind[one("kind")!]
              : undefined,
        problem: problem?.id,
        repeat: repeat ? { id: repeat.id, title: repeat.title } : undefined,
        title: one("q")?.trim() || undefined,
        category: community?.name,
      }}
    />
  );
}
