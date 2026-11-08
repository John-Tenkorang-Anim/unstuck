import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CircleDashed,
  FlaskConical,
  GitBranch,
  Lightbulb,
  Plus,
  ShieldCheck,
  Target,
} from "lucide-react";
import {
  describeStatus,
  statusTone,
  type Improvement,
} from "@/lib/improvements";
import { evidenceOf, outcomeOf, outcomeText, outcomeTone } from "@/lib/outcome";
import { stateLabel, type ProblemState } from "@/lib/problems";
import { testStatusLabel, type Test } from "@/lib/tests";
import type { EntrySummary } from "@/lib/types";

/** A status in words, with a colour that only ever repeats the words. */
export function Pill({
  tone,
  children,
}: {
  tone: string;
  children: ReactNode;
}) {
  return (
    <span className="pill" data-tone={tone}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}
export const ProposalStatus = ({
  improvement,
}: {
  improvement: Pick<Improvement, "status" | "verdict">;
}) => <Pill tone={statusTone(improvement)}>{describeStatus(improvement)}</Pill>;
export const ProblemStatePill = ({ state }: { state: ProblemState }) => (
  <Pill
    tone={
      state === "tested"
        ? "worked"
        : state === "progress"
          ? "ongoing"
          : state === "archived"
            ? "quiet"
            : "open"
    }
  >
    {stateLabel[state]}
  </Pill>
);
export function AttemptOutcome({
  entry,
  validated = 0,
}: {
  entry: Pick<EntrySummary, "kind" | "outcome">;
  validated?: number;
}) {
  const kind = outcomeOf(entry, validated);
  return (
    <span className="attempt-result">
      <Pill tone={outcomeTone[kind]}>{outcomeText[kind]}</Pill>
      {validated > 0 && (
        <small>
          {validated} supported {validated === 1 ? "follow-up" : "follow-ups"}
        </small>
      )}
    </span>
  );
}
/** What kind of evidence stands behind something: never a credibility score. */
export function EvidenceTag({
  entry,
}: {
  entry: Parameters<typeof evidenceOf>[0];
}) {
  const e = evidenceOf(entry);
  return (
    <span className="evidence-tag" data-level={e.level}>
      <ShieldCheck size={13} aria-hidden="true" />
      {e.label}
    </span>
  );
}

/** Contextual tabs as plain links, so every tab has an address. */
export function Tabs({
  tabs,
  current,
  href,
  label,
}: {
  tabs: readonly (readonly [string, string, number?])[];
  current: string;
  href: (key: string) => string;
  label: string;
}) {
  return (
    <nav className="tabs" aria-label={label}>
      {tabs.map(([key, text, count]) => (
        <Link
          key={key}
          href={href(key)}
          aria-current={current === key ? "page" : undefined}
          scroll={false}
        >
          {text}
          {count !== undefined && count > 0 && (
            <span className="tab-count">{count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/* The Progress Trail ----------------------------------------------------- */

export interface Branch {
  attempt?: EntrySummary;
  improvement?: Improvement;
  tests: Test[];
}
/** Lay a problem’s work out as branches: one per attempt and proposal. */
export function branchesFor(
  attempts: EntrySummary[],
  improvements: Improvement[],
  tests: Test[],
): Branch[] {
  const testsFor = (i: Improvement) =>
    tests.filter((t) => t.improvementId === i.id);
  const branches: Branch[] = [];
  for (const attempt of attempts) {
    const own = improvements.filter((i) => i.entryId === attempt.id);
    if (!own.length) branches.push({ attempt, tests: [] });
    for (const improvement of own)
      branches.push({ attempt, improvement, tests: testsFor(improvement) });
  }
  for (const improvement of improvements.filter(
    (i) => !i.entryId || !attempts.some((a) => a.id === i.entryId),
  ))
    branches.push({ improvement, tests: testsFor(improvement) });
  return branches;
}
function outcomeOfBranch(b: Branch) {
  const done = b.tests.find((t) => t.findings?.verdict);
  if (done?.findings?.verdict === "supported")
    return { tone: "worked", text: "Worked under tested conditions" };
  if (done?.findings?.verdict === "not_supported")
    return { tone: "failed", text: "Didn’t work when tested" };
  if (done?.findings?.verdict)
    return { tone: "mixed", text: "Mixed or inconclusive" };
  if (b.improvement?.status === "evaluated" && b.improvement.verdict)
    return {
      tone: statusTone(b.improvement),
      text:
        b.improvement.verdict === "supported"
          ? "Worked under tested conditions"
          : describeStatus(b.improvement),
    };
  if (b.tests.length) return { tone: "ongoing", text: "Being tested" };
  return undefined;
}

/**
 * The signature view: Problem → Attempts → Evidence → Improvements → Tests →
 * Outcomes, with a branch for each line of work. Every node opens its record;
 * empty stages say what would move the branch on.
 */
export function ProgressTrail({
  problem,
  branches,
  compact = false,
}: {
  problem: { id: string; title: string };
  branches: Branch[];
  compact?: boolean;
}) {
  const shown = compact ? branches.slice(0, 3) : branches;
  return (
    <div className="trail-wrap" data-compact={compact || undefined}>
      <ol className="trail-stages" aria-hidden="true">
        {[
          "Problem",
          "Attempt",
          "Evidence",
          "Improvement",
          "Test",
          "Outcome",
        ].map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <div
        className="trail"
        role="list"
        aria-label={`Progress trail for ${problem.title}`}
      >
        <div className="trail-root" role="listitem">
          <Link
            className="trail-node"
            data-kind="problem"
            href={`/problems/${problem.id}`}
          >
            <Target size={14} aria-hidden="true" />
            <span>{problem.title}</span>
          </Link>
        </div>
        <div className="trail-branches">
          {shown.length === 0 && (
            <div className="trail-branch" role="listitem">
              <Link
                className="trail-node trail-empty"
                href={`/new?type=attempt&problem=${problem.id}`}
              >
                <Plus size={13} aria-hidden="true" /> No attempts yet. Share one
              </Link>
            </div>
          )}
          {shown.map((b, i) => {
            const out = outcomeOfBranch(b);
            const evidence = b.attempt ? evidenceOf(b.attempt) : undefined;
            return (
              <div className="trail-branch" role="listitem" key={i}>
                <span className="sr-only">Branch {i + 1}: </span>
                {b.attempt ? (
                  <Link
                    className="trail-node"
                    data-kind="attempt"
                    data-tone={outcomeTone[outcomeOf(b.attempt)]}
                    href={`/entries/${b.attempt.id}`}
                  >
                    <i className="trail-dot" aria-hidden="true" />
                    <span>{b.attempt.title}</span>
                    <small>{outcomeText[outcomeOf(b.attempt)]}</small>
                  </Link>
                ) : (
                  <span className="trail-node trail-empty">
                    Proposed directly
                  </span>
                )}
                {evidence ? (
                  <Link
                    className="trail-node"
                    data-kind="evidence"
                    href={`/entries/${b.attempt!.id}?tab=evidence`}
                  >
                    <ShieldCheck size={13} aria-hidden="true" />
                    <span>{evidence.label}</span>
                  </Link>
                ) : (
                  <span className="trail-node trail-empty">—</span>
                )}
                {b.improvement ? (
                  <Link
                    className="trail-node"
                    data-kind="improvement"
                    data-tone={statusTone(b.improvement)}
                    href={`/improvements/${b.improvement.id}`}
                  >
                    <Lightbulb size={13} aria-hidden="true" />
                    <span>{b.improvement.title}</span>
                    <small>{describeStatus(b.improvement)}</small>
                  </Link>
                ) : (
                  <Link
                    className="trail-node trail-empty"
                    href={
                      b.attempt
                        ? `/improvements/new?entry=${b.attempt.id}`
                        : `/improvements/new?problem=${problem.id}`
                    }
                  >
                    <Plus size={13} aria-hidden="true" /> Propose
                  </Link>
                )}
                {b.tests.length ? (
                  <span className="trail-stack">
                    {b.tests.map((t) => (
                      <Link
                        key={t.id}
                        className="trail-node"
                        data-kind="test"
                        href={`/tests/${t.id}`}
                      >
                        <FlaskConical size={13} aria-hidden="true" />
                        <span>{t.title}</span>
                        <small>{testStatusLabel[t.status]}</small>
                      </Link>
                    ))}
                  </span>
                ) : b.improvement ? (
                  <Link
                    className="trail-node trail-empty"
                    href={`/tests/new?improvement=${b.improvement.id}`}
                  >
                    <Plus size={13} aria-hidden="true" /> Plan a test
                  </Link>
                ) : (
                  <span className="trail-node trail-empty">—</span>
                )}
                {out ? (
                  <span
                    className="trail-node"
                    data-kind="outcome"
                    data-tone={out.tone}
                  >
                    <i className="trail-dot" aria-hidden="true" />
                    <span>{out.text}</span>
                  </span>
                ) : (
                  <span className="trail-node trail-empty">
                    <CircleDashed size={13} aria-hidden="true" /> Not yet known
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {compact && branches.length > shown.length && (
        <Link
          className="text-link trail-more"
          href={`/problems/${problem.id}?tab=progress`}
        >
          {branches.length - shown.length} more branches{" "}
          <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}

/** A one-line trail for lists: attempt → proposal → test → outcome. */
export function MiniTrail({ branch }: { branch: Branch }) {
  const out = outcomeOfBranch(branch);
  const steps: { tone?: string; icon: ReactNode; text: string }[] = [];
  if (branch.attempt)
    steps.push({
      tone: outcomeTone[outcomeOf(branch.attempt)],
      icon: <i className="trail-dot" />,
      text: outcomeText[outcomeOf(branch.attempt)],
    });
  if (branch.improvement)
    steps.push({
      tone: statusTone(branch.improvement),
      icon: <GitBranch size={12} />,
      text: "Improvement proposed",
    });
  if (branch.tests.length)
    steps.push({
      icon: <FlaskConical size={12} />,
      text: `${branch.tests.length} ${branch.tests.length === 1 ? "test" : "tests"}`,
    });
  if (out)
    steps.push({
      tone: out.tone,
      icon: <i className="trail-dot" />,
      text: out.text,
    });
  return (
    <ol className="mini-trail" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={i} data-tone={s.tone}>
          <span aria-hidden="true">{s.icon}</span>
          {s.text}
        </li>
      ))}
    </ol>
  );
}

/** A labelled block in a page’s side rail. */
export function RailBlock({
  title,
  children,
  id,
}: {
  title: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="rail-block" id={id} aria-label={title}>
      <h2 className="rail-title">{title}</h2>
      {children}
    </section>
  );
}
