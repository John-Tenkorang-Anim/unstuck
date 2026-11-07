"use client";
import Link from "next/link";
import { ArrowUpRight, Bookmark } from "lucide-react";
import { ViewTransition } from "react";
import { kindLabels, outcomeLabels } from "@/lib/data";
import type { EntrySummary as Entry } from "@/lib/types";
import { OutcomeGlyph } from "./glyph";
import { useNotebook } from "./notebook-provider";

export function SaveButton({
  id,
  compact = false,
}: {
  id: string;
  compact?: boolean;
}) {
  const { saved, toggleSaved } = useNotebook();
  const active = saved.includes(id);
  return (
    <button
      className={`save-button ${active ? "is-saved" : ""} ${compact ? "save-compact" : "button button-outline"}`}
      aria-label={active ? "Remove from notebook" : "Save to notebook"}
      aria-pressed={active}
      onClick={() => toggleSaved(id)}
    >
      <Bookmark size={15} fill={active ? "currentColor" : "none"} />
      {!compact && <span>{active ? "Saved" : "Save for later"}</span>}
    </button>
  );
}
export function OutcomeBadge({ outcome }: { outcome: Entry["outcome"] }) {
  return (
    <span className="outcome-badge" data-outcome={outcome ?? "open"}>
      <OutcomeGlyph outcome={outcome ?? "open"} />
      {outcome ? outcomeLabels[outcome] : "Open"}
    </span>
  );
}
/**
 * One story in the mosaic. The lead story is a full-colour tile; the rest are
 * tinted by outcome. The whole tile is the link target; Save sits above it.
 */
export function EntryTile({
  entry,
  size = "standard",
  span,
}: {
  entry: Entry;
  size?: "lead" | "side" | "standard";
  span?: number;
}) {
  return (
    <article
      className="tile"
      data-outcome={entry.outcome ?? "open"}
      data-size={size}
      style={span ? ({ "--span": span } as React.CSSProperties) : undefined}
    >
      <div className="tile-top">
        <OutcomeBadge outcome={entry.outcome} />
        <span className="tile-field">{entry.topic}</span>
        <div className="tile-save">
          <SaveButton id={entry.id} compact />
        </div>
      </div>
      <ViewTransition name={`title-${entry.id}`} share="morph" default="none">
        <h3>
          <Link href={`/entries/${entry.id}`} className="tile-link">
            {entry.title}
          </Link>
        </h3>
      </ViewTransition>
      <p className="tile-excerpt">{entry.excerpt}</p>
      <div className="tile-foot">
        <p className="tile-tried">
          <span className="tile-figure">{entry.tried}</span>
          <span>{entry.tried ? "tried it" : "No attempts yet"}</span>
        </p>
        <p className="tile-meta">
          <span>{entry.helped} helped</span>
          <span>{entry.comments} replies</span>
          <span>{entry.place}</span>
        </p>
        <ArrowUpRight size={20} className="tile-arrow" aria-hidden="true" />
      </div>
    </article>
  );
}
