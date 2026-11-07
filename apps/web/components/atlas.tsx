"use client";
import Link from "next/link";
import { useState, type MouseEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import { outcomeLabels, topics } from "@/lib/data";
import type { EntrySummary } from "@/lib/types";
import { OutcomeGlyph, type OutcomeKey } from "./glyph";

export const atlasColumns: { key: OutcomeKey; label: string; long: string }[] =
  [
    { key: "worked", label: "Worked", long: "it worked" },
    { key: "failed", label: "Didn’t", long: "it didn’t work" },
    { key: "mixed", label: "Mixed", long: "a mixed result" },
    { key: "ongoing", label: "Ongoing", long: "still learning" },
    { key: "open", label: "Open", long: "no result yet" },
  ];
export type AtlasSelection = { topic: string; outcome: OutcomeKey | "all" };
type Cell = { notes: number; tried: number; lead: EntrySummary };

function count(value: number, noun: string) {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}
function href({ topic, outcome }: AtlasSelection) {
  const query = new URLSearchParams();
  if (topic) query.set("topic", topic);
  if (outcome !== "all") query.set("outcome", outcome);
  const text = query.toString();
  return `/discover${text ? `?${text}` : ""}#discover`;
}

/**
 * Everything tried, as a field-by-outcome table that doubles as the feed's
 * filter. Pointing at a cell previews its most-tried story beside the grid.
 * Every target is a real link, so it works before hydration or without scripts.
 */
export function Atlas({
  entries,
  topic,
  outcome,
  onSelect,
}: {
  entries: EntrySummary[];
  topic: string;
  outcome: OutcomeKey | "all";
  onSelect: (selection: AtlasSelection) => void;
}) {
  const cells = new Map<string, Cell>();
  for (const entry of entries) {
    const key = `${entry.topic}|${entry.outcome ?? "open"}`;
    const cell = cells.get(key);
    if (!cell) cells.set(key, { notes: 1, tried: entry.tried, lead: entry });
    else {
      cell.notes += 1;
      cell.tried += entry.tried;
      if (entry.tried > cell.lead.tried) cell.lead = entry;
    }
  }
  const max = Math.max(1, ...[...cells.values()].map((cell) => cell.tried));
  const mostTried = [...entries].sort((a, b) => b.tried - a.tried)[0];
  const [preview, setPreview] = useState<{
    entry: EntrySummary;
    context: string;
  } | null>(null);
  const shown =
    preview ??
    (mostTried ? { entry: mostTried, context: "Most tried so far" } : null);
  const filtered = !!topic || outcome !== "all";
  function follow(event: MouseEvent, selection: AtlasSelection) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button)
      return;
    event.preventDefault();
    onSelect(selection);
  }
  return (
    <div className="atlas-stage">
      <figure className="atlas">
        <div className="atlas-caption">
          <span>The map of attempts</span>
          <span className="atlas-hint">Point at a cell to preview it</span>
        </div>
        <table onMouseLeave={() => setPreview(null)}>
          <caption className="sr-only">
            People who tried each entry, by field and outcome
          </caption>
          <thead>
            <tr>
              <td />
              {atlasColumns.map((column) => {
                const next = { topic: "", outcome: column.key };
                return (
                  <th key={column.key} scope="col" data-outcome={column.key}>
                    <a
                      href={href(next)}
                      aria-label={`Show every entry where ${column.long}`}
                      onClick={(event) => follow(event, next)}
                    >
                      <OutcomeGlyph outcome={column.key} size={13} />
                      {column.label}
                    </a>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {topics.map((field) => {
              const next = { topic: field, outcome: "all" as const };
              return (
                <tr key={field}>
                  <th scope="row">
                    <a
                      href={href(next)}
                      aria-label={`Show every entry in ${field}`}
                      onClick={(event) => follow(event, next)}
                    >
                      {field}
                    </a>
                  </th>
                  {atlasColumns.map((column, index) => {
                    const cell = cells.get(`${field}|${column.key}`);
                    if (!cell)
                      return (
                        <td key={column.key} className="atlas-empty">
                          <span aria-hidden="true" />
                          <span className="sr-only">Nothing recorded</span>
                        </td>
                      );
                    const selection = { topic: field, outcome: column.key };
                    const selected = topic === field && outcome === column.key;
                    const dimmed =
                      filtered &&
                      ((topic && topic !== field) ||
                        (outcome !== "all" && outcome !== column.key));
                    const tip = `${field}, ${column.long}: ${count(cell.notes, "note")}, ${cell.tried} tried`;
                    const show = () =>
                      setPreview({
                        entry: cell.lead,
                        context: `${field} · ${column.long}`,
                      });
                    return (
                      <td
                        key={column.key}
                        data-outcome={column.key}
                        className={dimmed ? "atlas-cell is-dim" : "atlas-cell"}
                        style={
                          {
                            "--heat": (
                              0.5 +
                              0.5 * Math.sqrt(cell.tried / max)
                            ).toFixed(3),
                          } as React.CSSProperties
                        }
                      >
                        <a
                          href={href(
                            selected
                              ? { topic: "", outcome: "all" }
                              : selection,
                          )}
                          aria-label={tip}
                          aria-current={selected ? "true" : undefined}
                          data-edge={index > 2 ? "end" : "start"}
                          onMouseEnter={show}
                          onFocus={show}
                          onClick={(event) =>
                            follow(
                              event,
                              selected
                                ? { topic: "", outcome: "all" }
                                : selection,
                            )
                          }
                        >
                          <span className="atlas-value">{cell.tried}</span>
                          {cell.notes > 1 && (
                            <span className="atlas-notes" aria-hidden="true">
                              {cell.notes}
                            </span>
                          )}
                        </a>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <figcaption>
          Each number is how many people tried it, and brighter means more. A
          blank cell is a gap nobody has filled yet.
        </figcaption>
      </figure>
      {shown && (
        <div
          className="spotlight"
          data-outcome={shown.entry.outcome ?? "open"}
          key={shown.entry.id + shown.context}
        >
          <p className="spotlight-context">{shown.context}</p>
          <p className="spotlight-verdict">
            <OutcomeGlyph outcome={shown.entry.outcome ?? "open"} size={16} />
            {shown.entry.outcome
              ? outcomeLabels[shown.entry.outcome]
              : "Still open"}
          </p>
          <p className="spotlight-title">{shown.entry.title}</p>
          <p className="spotlight-excerpt">{shown.entry.excerpt}</p>
          <dl className="spotlight-stats">
            <div>
              <dt>Tried it</dt>
              <dd>{shown.entry.tried}</dd>
            </div>
            <div>
              <dt>Helped</dt>
              <dd>{shown.entry.helped}</dd>
            </div>
            <div>
              <dt>Where</dt>
              <dd className="spotlight-place">{shown.entry.place}</dd>
            </div>
          </dl>
          <Link className="spotlight-link" href={`/entries/${shown.entry.id}`}>
            Read the story <ArrowUpRight size={15} />
          </Link>
        </div>
      )}
    </div>
  );
}
