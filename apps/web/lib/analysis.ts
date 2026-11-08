/**
 * Compare & Analyze: line up attempts at the same problem, find the factors
 * that separate what failed from what worked, and say how sure we can be.
 * Every statement cites the records it comes from and is labelled as an
 * observation, a hypothesis or verified. Nothing is presented as fact unless
 * the records show it was checked.
 */
export type Result = "failed" | "partial" | "succeeded" | "unknown";
export type EvidenceKind = "verified" | "replicated" | "measured" | "personal";
export const evidenceText: Record<EvidenceKind, string> = {
  verified: "Verified measurements",
  replicated: "Independently replicated",
  measured: "Measured data",
  personal: "Personal account",
};
export const resultText: Record<Result, string> = {
  failed: "Failed",
  partial: "Partially worked",
  succeeded: "Succeeded",
  unknown: "No completed result",
};
export interface Attempt {
  id: string;
  label: string;
  title: string;
  /** Links to the full experience when there is one. */
  entryId?: string;
  improvementId?: string;
  values: Record<string, string>;
  /** The measured result, for ordering and patterns. */
  measure?: number;
  result: Result;
  evidence: EvidenceKind;
  by: string;
}
export interface ComparisonSet {
  slug: string;
  title: string;
  question: string;
  measureLabel: string;
  measureUnit?: string;
  factors: string[];
  attempts: Attempt[];
  sample?: boolean;
}

export const comparisonSets: ComparisonSet[] = [
  {
    slug: "plastic-biodegradation",
    title: "Comparing attempts to improve plastic biodegradation",
    question:
      "Why did the same bacterial strain degrade plastic film well in some runs and poorly in others?",
    measureLabel: "Degradation",
    measureUnit: "%",
    factors: [
      "Scale",
      "Oxygen transfer",
      "Substrate concentration",
      "Temperature",
    ],
    sample: true,
    attempts: [
      {
        id: "A",
        label: "Attempt A",
        title: "Our microbial biodegradation test failed at scale",
        entryId: "microbial-biodegradation-failed-at-scale",
        values: {
          Scale: "10 L",
          "Oxygen transfer": "Low",
          "Substrate concentration": "10 g/L",
          Temperature: "30 °C",
        },
        measure: 20,
        result: "failed",
        evidence: "verified",
        by: "bench-notes-15",
      },
      {
        id: "B",
        label: "Attempt B",
        title: "The same run with finer spargers and half the substrate",
        improvementId: "sample-improvement-biodegradation",
        entryId: "microbial-biodegradation-failed-at-scale",
        values: {
          Scale: "10 L",
          "Oxygen transfer": "High",
          "Substrate concentration": "5 g/L",
          Temperature: "30 °C",
        },
        measure: 85,
        result: "succeeded",
        evidence: "measured",
        by: "bench-notes-15",
      },
      {
        id: "C",
        label: "Attempt C",
        title: "The original shaken-flask run",
        values: {
          Scale: "1 L",
          "Oxygen transfer": "High",
          "Substrate concentration": "10 g/L",
          Temperature: "30 °C",
        },
        measure: 80,
        result: "succeeded",
        evidence: "measured",
        by: "bench-notes-15",
      },
      {
        id: "D",
        label: "Attempt D",
        title: "A 50 L pilot in another lab",
        values: {
          Scale: "50 L",
          "Oxygen transfer": "Low",
          "Substrate concentration": "5 g/L",
          Temperature: "28 °C",
        },
        measure: 25,
        result: "failed",
        evidence: "personal",
        by: "pilot-plant-08",
      },
      {
        id: "E",
        label: "Attempt E",
        title: "A warmer run to speed up growth",
        values: {
          Scale: "10 L",
          "Oxygen transfer": "High",
          "Substrate concentration": "10 g/L",
          Temperature: "37 °C",
        },
        measure: 60,
        result: "partial",
        evidence: "measured",
        by: "night-shift-lab-03",
      },
      {
        id: "F",
        label: "Attempt F",
        title: "The 50 L pilot repeated with better aeration",
        values: {
          Scale: "50 L",
          "Oxygen transfer": "High",
          "Substrate concentration": "5 g/L",
          Temperature: "30 °C",
        },
        measure: 78,
        result: "succeeded",
        evidence: "replicated",
        by: "pilot-plant-08",
      },
    ],
  },
];

export interface FactorPattern {
  factor: string;
  /** For each value: which attempts had it, and how they turned out. */
  values: {
    value: string;
    attempts: Attempt[];
    succeeded: number;
    failed: number;
  }[];
  /** 0 to 1: how cleanly this factor separates failures from successes. */
  separation: number;
}
/** How cleanly each factor separates what failed from what worked. */
export function factorPatterns(set: ComparisonSet): FactorPattern[] {
  return set.factors
    .map((factor) => {
      const groups = new Map<string, Attempt[]>();
      for (const a of set.attempts) {
        const v = a.values[factor] ?? "Not recorded";
        groups.set(v, [...(groups.get(v) ?? []), a]);
      }
      const values = [...groups.entries()].map(([value, attempts]) => ({
        value,
        attempts,
        succeeded: attempts.filter((a) => a.result === "succeeded").length,
        failed: attempts.filter((a) => a.result === "failed").length,
      }));
      // Clean groups: every attempt with this value failed, or none did.
      const recorded = values.filter((v) => v.value !== "Not recorded");
      const known = recorded
        .flatMap((v) => v.attempts)
        .filter((a) => a.result !== "unknown");
      const bothOutcomes =
        known.some((a) => a.result === "failed") &&
        known.some((a) => a.result === "succeeded");
      const pure = recorded
        .filter(
          (v) =>
            v.failed === v.attempts.length || v.succeeded === v.attempts.length,
        )
        .reduce((n, v) => n + v.attempts.length, 0);
      const separation =
        recorded.length > 1 && known.length && bothOutcomes
          ? pure / known.length
          : 0;
      return { factor, values, separation };
    })
    .sort((a, b) => b.separation - a.separation);
}

export type InsightKind = "observation" | "hypothesis" | "verified";
export interface Insight {
  kind: InsightKind;
  text: string;
  /** The attempts this statement rests on. */
  refs: string[];
  confidence: "low" | "moderate" | "high";
}
/**
 * Descriptive associations, never causal verification. A reviewed source does
 * not verify a comparison across different contributors and conditions.
 */
export function insights(set: ComparisonSet): Insight[] {
  const out: Insight[] = [];
  if (set.attempts.length < 2) return out;
  const patterns = factorPatterns(set);
  for (const p of patterns.filter((p) => p.separation >= 0.8)) {
    const recorded = p.values.filter((v) => v.value !== "Not recorded");
    const best = [...recorded].sort(
      (a, b) =>
        b.succeeded / b.attempts.length - a.succeeded / a.attempts.length,
    )[0];
    const worst = [...recorded].sort(
      (a, b) => b.failed / b.attempts.length - a.failed / a.attempts.length,
    )[0];
    const mean = (xs: Attempt[]) => {
      const measured = xs.filter(
        (a) => typeof a.measure === "number" && Number.isFinite(a.measure),
      );
      return measured.length
        ? {
            n: measured.length,
            value:
              Math.round(
                (measured.reduce((sum, a) => sum + a.measure!, 0) /
                  measured.length) *
                  10,
              ) / 10,
          }
        : undefined;
    };
    const a = mean(best.attempts),
      b = mean(worst.attempts);
    const measurements =
      a && b
        ? ` Among measured attempts, mean ${set.measureLabel.toLowerCase()} was ${a.value}${set.measureUnit ?? ""} (${a.n} recorded) and ${b.value}${set.measureUnit ?? ""} (${b.n} recorded), respectively.`
        : "";
    out.push({
      kind: "observation",
      text: `${best.succeeded} of ${best.attempts.length} attempts with ${p.factor.toLowerCase()} “${best.value}” reported success, compared with ${worst.succeeded} of ${worst.attempts.length} with “${worst.value}”. This is an association in these records, not evidence that the factor caused the result.${measurements}`,
      refs: [
        ...new Set([...best.attempts, ...worst.attempts].map((a) => a.id)),
      ],
      confidence: "low",
    });
  }
  for (const p of patterns.filter((p) => p.separation < 0.8)) {
    out.push({
      kind: "observation",
      text: `These records do not establish a consistent relationship between ${p.factor.toLowerCase()} and the reported outcome. Missing conditions, incomplete results and other differences limit this comparison.`,
      refs: p.values.flatMap((v) => v.attempts.map((a) => a.id)),
      confidence: "low",
    });
  }
  const top = patterns[0];
  if (top && top.separation >= 0.8)
    out.push({
      kind: "hypothesis",
      text: `${top.factor} is a candidate for a follow-up test. Change that factor while keeping the other conditions comparable; this comparison alone cannot explain why the outcomes differed.`,
      refs: set.attempts.map((a) => a.id),
      confidence: "low",
    });
  return out;
}
