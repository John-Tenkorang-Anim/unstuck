import "server-only";
import { hasDatabase, query, showExamples, transaction } from "./db.server";
import type { PoolClient } from "pg";
import {
  emptyPlan,
  planFields,
  verdicts,
  type TestPlan,
  type Verdict,
} from "./improvements";
import {
  emptyFindings,
  sampleTests,
  type Findings,
  type ResultRow,
  type Test,
  type TestRun,
  type TestStatus,
} from "./tests";
import { clean, newId, StoreError, type Account } from "./store.server";

const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
const text = (v: unknown, max = 2000) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";
type Row = {
  id: string;
  owner: string;
  improvement_id: string | null;
  problem_id: string | null;
  status: TestStatus;
  data: Omit<
    Test,
    "id" | "owner" | "status" | "author" | "created" | "updated"
  >;
  created: Date;
  updated: Date;
  author: string;
};
const fromRow = (r: Row): Test => ({
  ...r.data,
  id: r.id,
  owner: r.owner,
  improvementId: r.improvement_id ?? undefined,
  problemId: r.problem_id ?? undefined,
  status: r.status,
  author: r.author,
  created: r.created.toISOString(),
  updated: r.updated.toISOString(),
});
const select = `SELECT t.*, a.name AS author FROM web.tests t JOIN web.accounts a ON a.id = t.owner`;

export async function allTests(filter?: {
  problemIds?: string[];
}): Promise<Test[]> {
  const samples = (showExamples() ? sampleTests : []).filter(
    (t) =>
      !filter?.problemIds ||
      (!!t.problemId && filter.problemIds.includes(t.problemId)),
  );
  if (!hasDatabase()) return samples;
  const rows = await query<Row>(
    `${select} WHERE NOT t.hidden ${filter?.problemIds ? "AND t.problem_id = ANY($1)" : ""}
    ORDER BY t.updated DESC LIMIT 500`,
    filter?.problemIds ? [filter.problemIds] : [],
  );
  return [...samples, ...rows.map(fromRow)];
}
export async function getTest(id: string) {
  const sample = (showExamples() ? sampleTests : []).find((t) => t.id === id);
  if (sample) return sample;
  if (!hasDatabase() || !isUuid(id)) return undefined;
  const [row] = await query<Row>(`${select} WHERE t.id = $1 AND NOT t.hidden`, [
    id,
  ]);
  return row ? fromRow(row) : undefined;
}

function readPlan(input: unknown): TestPlan {
  const raw = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;
  return {
    ...emptyPlan(),
    ...Object.fromEntries(planFields.map(([k]) => [k, text(raw[k])])),
  };
}
/** Start a test record for a proposal, an attempt or a problem. */
export async function createTest(
  account: Account,
  input: Record<string, unknown>,
  link: { improvementId?: string; entryId?: string; problemId?: string },
) {
  const title = clean.text(input.title, 4, 140, "The test’s title");
  const plan = readPlan(input.plan);
  if (plan.objective.length < 5)
    throw new StoreError("Say what the test should find out.");
  const conditions = String(input.conditions ?? "")
    .split("\n")
    .map((c) => c.trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, 12);
  const id = newId();
  await query(
    `INSERT INTO web.tests (id, owner, improvement_id, problem_id, status, data) VALUES ($1,$2,$3,$4,'planned',$5)`,
    [
      id,
      account.id,
      link.improvementId ?? null,
      link.problemId ?? null,
      {
        title,
        entryId: link.entryId,
        plan,
        conditions,
        runs: [],
        results: { summary: "", rows: [] },
        findings: null,
      },
    ],
  );
  return id;
}

async function ownTest(account: Account, id: string, client: PoolClient) {
  if (!isUuid(id)) throw new StoreError("That test doesn’t exist.", 404);
  const {
    rows: [row],
  } = await client.query<Row>(
    `${select} WHERE t.id = $1 AND NOT t.hidden FOR UPDATE OF t`,
    [id],
  );
  if (!row) throw new StoreError("That test doesn’t exist.", 404);
  if (row.owner !== account.id && !account.moderator)
    throw new StoreError(
      "Only the person running this test can change it.",
      403,
    );
  return row;
}
/**
 * Record a run, the results against the success criteria, or the findings.
 * Findings say how confident they are and what limits them.
 */
export async function updateTest(
  account: Account,
  id: string,
  input: Record<string, unknown>,
) {
  return transaction(async (client) => {
    const row = await ownTest(account, id, client);
    const data = { ...row.data };
    let status = row.status;
    if (input.action === "run") {
      const run: TestRun = {
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(input.date))
          ? String(input.date)
          : new Date().toISOString().slice(0, 10),
        conditions: text(input.conditions, 500),
        measurement: clean.text(
          input.measurement,
          1,
          500,
          "What you measured or saw",
        ),
        deviation: text(input.deviation, 500),
        by: account.name,
      };
      data.runs = [...(data.runs ?? []), run].slice(-200);
      if (status === "planned") status = "running";
    } else if (input.action === "results") {
      const rows = (Array.isArray(input.rows) ? input.rows : [])
        .filter(Boolean)
        .slice(0, 20)
        .map((r: Record<string, unknown>): ResultRow => ({
          measure: text(r.measure, 200),
          criterion: text(r.criterion, 200),
          observed: text(r.observed, 200),
          met:
            r.met === true || r.met === "true"
              ? true
              : r.met === false || r.met === "false"
                ? false
                : null,
        }))
        .filter((r) => r.measure);
      data.results = { summary: text(input.summary), rows };
    } else if (input.action === "findings") {
      const verdict = verdicts.includes(input.verdict as Verdict)
        ? (input.verdict as Verdict)
        : null;
      const findings: Findings = {
        ...emptyFindings(),
        happened: clean.text(input.happened, 5, 2000, "What happened"),
        verdict,
        confidence:
          (["low", "moderate", "high"] as const).find(
            (c) => c === input.confidence,
          ) ?? "low",
        limitations: text(input.limitations),
        next: text(input.next),
      };
      data.findings = findings;
      status = "complete";
    } else throw new StoreError("Nothing to update.");
    await client.query(
      `UPDATE web.tests SET data = $2, status = $3, updated = now() WHERE id = $1`,
      [id, data, status],
    );
  });
}
