import "server-only";
import { getNotebook } from "./api";
import { hasDatabase, query, showExamples } from "./db.server";
import { allImprovements, listImprovements } from "./improvements.server";
import { publishedEntries } from "./entries.server";
import { summarizeEntry } from "./types";
import {
  problemState,
  sampleProblems,
  type Problem,
  type ProblemState,
} from "./problems";
import { categoryName, categorySlug } from "./taxonomy";
import { allTests } from "./tests.server";
import { clean, newId, StoreError, type Account } from "./store.server";
import type { EntrySummary } from "./types";
import type { Improvement } from "./improvements";
import type { Test } from "./tests";

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
type Row = {
  id: string;
  owner: string;
  data: Problem;
  created: Date;
  author: string;
};
const fromRow = (r: Row): Problem => ({
  ...r.data,
  id: r.id,
  owner: r.owner,
  author: r.author,
  created: r.created.toISOString().slice(0, 10),
});

export async function listProblems(): Promise<Problem[]> {
  if (!hasDatabase()) return showExamples() ? sampleProblems : [];
  const rows = await query<Row>(
    `SELECT p.id, p.owner, p.data, p.created, a.name AS author FROM web.problems p
     JOIN web.accounts a ON a.id = p.owner WHERE NOT p.hidden ORDER BY p.created DESC LIMIT 300`,
  );
  return [...rows.map(fromRow), ...(showExamples() ? sampleProblems : [])];
}
export async function getProblem(id: string): Promise<Problem | undefined> {
  const sample = (showExamples() ? sampleProblems : []).find(
    (p) => p.id === id,
  );
  if (sample) return sample;
  if (!hasDatabase() || !isUuid(id)) return undefined;
  const [row] = await query<Row>(
    `SELECT p.id, p.owner, p.data, p.created, a.name AS author FROM web.problems p
     JOIN web.accounts a ON a.id = p.owner WHERE p.id = $1 AND NOT p.hidden`,
    [id],
  );
  return row ? fromRow(row) : undefined;
}

export interface ProblemWork {
  problem: Problem;
  attempts: EntrySummary[];
  /** The open question that first described it, when there is one. */
  origin?: EntrySummary;
  improvements: Improvement[];
  tests: Test[];
  state: ProblemState;
  contributors: string[];
  updated: string;
}
/**
 * Everything connected to each problem, computed from the same records that
 * appear on attempts, proposals and profiles, so nothing is a stale copy.
 */
export async function problemsWithWork(
  only?: string[],
): Promise<ProblemWork[]> {
  const selected = only
    ? (await Promise.all(only.map(getProblem))).filter((p): p is Problem => !!p)
    : await listProblems();
  const [problems, notebook, improvements, tests] = await Promise.all([
    selected,
    getNotebook(),
    only
      ? Promise.all(
          only.map((problemId) => listImprovements({ problemId })),
        ).then((groups) => groups.flat())
      : allImprovements(300),
    allTests(only ? { problemIds: only } : undefined),
  ]);
  if (only && hasDatabase()) {
    const linked = await publishedEntries({ problemIds: only });
    const ids = new Set(linked.map((e) => e.id));
    notebook.entries = [
      ...linked.map(summarizeEntry),
      ...notebook.entries.filter((e) => !ids.has(e.id)),
    ];
  }
  return problems
    .filter((p) => !only || only.includes(p.id))
    .map((problem) => {
      const linked = notebook.entries.filter((e) => e.problem === problem.id);
      const attempts = linked.filter((e) => e.kind !== "problem");
      const origin =
        notebook.entries.find((e) => e.id === problem.origin) ??
        linked.find((e) => e.kind === "problem");
      const ids = new Set(attempts.map((a) => a.id));
      const imps = improvements.filter(
        (i) => i.problemId === problem.id || (i.entryId && ids.has(i.entryId)),
      );
      const impIds = new Set(imps.map((i) => i.id));
      const ts = tests.filter(
        (t) =>
          t.problemId === problem.id ||
          (t.improvementId && impIds.has(t.improvementId)),
      );
      const contributors = [
        ...new Set([
          problem.author,
          ...attempts.map((a) => a.alias),
          ...imps.flatMap((i) => [i.author, ...i.collaborators]),
          ...ts.map((t) => t.author),
        ]),
      ].filter((n) => n && n !== "Historical record");
      const updated = [
        problem.created,
        ...attempts.map((a) => a.date),
        ...imps.map((i) => i.updated),
        ...ts.map((t) => t.updated),
      ]
        .sort()
        .at(-1)!;
      const state = problemState(problem, {
        tests: ts.length,
        testsDone: ts.filter((t) => t.status === "complete").length,
        improvementsActive: imps.filter((i) => i.status !== "draft").length,
      });
      return {
        problem,
        attempts,
        origin,
        improvements: imps,
        tests: ts,
        state,
        contributors,
        updated: updated.slice(0, 10),
      };
    });
}
export async function problemWork(id: string) {
  return (await problemsWithWork([id]))[0];
}

/** Describe a problem someone needs help with. */
export async function createProblem(
  account: Account,
  input: Record<string, unknown>,
) {
  const title = clean.text(input.title, 8, 160, "The problem");
  const summary = clean.text(input.summary, 10, 2000, "A short description");
  const list = (v: unknown) =>
    (Array.isArray(v) ? v : String(v ?? "").split("\n"))
      .map((x) => String(x).trim().slice(0, 300))
      .filter(Boolean)
      .slice(0, 8);
  const text = (v: unknown) =>
    typeof v === "string" ? v.trim().slice(0, 2000) : "";
  const category = categoryName(input.category) || "General";
  const problem: Omit<Problem, "id" | "author" | "created"> = {
    title,
    summary,
    category,
    categorySlug: categorySlug(category),
    place: text(input.place).slice(0, 120) || undefined,
    affects: text(input.affects),
    matters: text(input.matters),
    constraints: list(input.constraints),
    known: [],
    unknowns: list(input.unknowns),
    needs: list(input.needs),
  };
  const id = newId();
  await query("INSERT INTO web.problems (id, owner, data) VALUES ($1,$2,$3)", [
    id,
    account.id,
    problem,
  ]);
  return id;
}
export async function problemOrFail(id: string) {
  const p = await getProblem(id);
  if (!p) throw new StoreError("That problem doesn’t exist.", 404);
  return p;
}

/** Problems someone described, for My Space and their profile. */
export async function problemsBy(accountId: string) {
  return (await listProblems()).filter((p) => p.owner === accountId);
}
