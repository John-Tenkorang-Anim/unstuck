import type { EntrySummary } from "./types";

/**
 * Preserve the result of this attempt. Follow-up work has its own outcome;
 * it cannot retroactively change what happened in the original conditions.
 */
export type OutcomeKind = "failed" | "partial" | "worked" | "progress" | "open";
export const outcomeText: Record<OutcomeKind, string> = {
  failed: "Didn’t work",
  partial: "Partially worked",
  worked: "Worked here",
  progress: "In progress",
  open: "Open problem",
};
/** Which colour token each outcome uses (checked for colour blindness). */
export const outcomeTone: Record<OutcomeKind, string> = {
  failed: "failed",
  partial: "mixed",
  worked: "worked",
  progress: "ongoing",
  open: "open",
};
export function outcomeOf(
  entry: Pick<EntrySummary, "kind" | "outcome">,
  _validatedImprovements = 0,
): OutcomeKind {
  if (entry.kind === "problem" && !entry.outcome) return "open";
  if (entry.outcome === "failed") return "failed";
  if (entry.outcome === "mixed") return "partial";
  if (entry.outcome === "worked") return "worked";
  return entry.outcome === "ongoing" ? "progress" : "open";
}
/** What was actually checked, never a guess about credibility. */
export function evidenceOf(entry: {
  evidence?: { state: string }[];
  cover?: unknown;
  clip?: unknown;
  /** Sample photos are illustrations, not evidence. */
  example?: boolean;
}) {
  const states = (entry.evidence ?? []).map((e) => e.state);
  if (states.includes("verified"))
    return { level: 3, label: "Verified evidence" };
  if (states.includes("supported"))
    return { level: 2, label: "Supported by others" };
  if (!entry.example && (entry.cover || entry.clip))
    return { level: 1, label: "Photos or video" };
  return { level: 0, label: "Personal account" };
}
