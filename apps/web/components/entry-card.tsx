"use client";
import Link from "next/link";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  FlaskConical,
  MapPin,
  MessageCircle,
  MoveUpRight,
} from "lucide-react";
import { Artwork } from "./artwork";
import { kindLabels, outcomeLabels } from "@/lib/data";
import type { EntrySummary as Entry } from "@/lib/types";
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
      className={`save-button ${active ? "is-saved" : ""} ${compact ? "save-compact" : ""}`}
      aria-label={active ? "Remove from notebook" : "Save to notebook"}
      aria-pressed={active}
      onClick={() => toggleSaved(id)}
    >
      <Bookmark size={17} fill={active ? "currentColor" : "none"} />
      {!compact && <span>{active ? "Saved" : "Save for later"}</span>}
    </button>
  );
}
export function OutcomeBadge({ outcome }: { outcome: Entry["outcome"] }) {
  return (
    <span className={`outcome-badge outcome-${outcome ?? "question"}`}>
      {outcome === "worked" ? (
        <Check size={12} />
      ) : outcome === "failed" ? (
        <span className="badge-x">×</span>
      ) : outcome === "ongoing" ? (
        <FlaskConical size={12} />
      ) : (
        <span className="badge-dot" />
      )}
      {outcome ? outcomeLabels[outcome] : "Let’s figure it out"}
    </span>
  );
}
export function EntryCard({
  entry,
  featured = false,
}: {
  entry: Entry;
  featured?: boolean;
}) {
  return (
    <article className={`entry-card ${featured ? "entry-featured" : ""}`}>
      <div className="card-art-wrap">
        <Link href={`/entries/${entry.id}`} tabIndex={-1} aria-hidden="true">
          <Artwork type={entry.illustration} />
        </Link>
        <span className="card-kind">{kindLabels[entry.kind]}</span>
        <div className="card-save">
          <SaveButton id={entry.id} compact />
        </div>
        {featured && (
          <span className="editor-pick">
            <span>✳</span> A SMALL IDEA, A BIG POSSIBILITY
          </span>
        )}
      </div>
      <div className="card-content">
        <div className="card-topline">
          <span className={`category category-${entry.illustration}`}>
            {entry.topic}
          </span>
          <OutcomeBadge outcome={entry.outcome} />
        </div>
        <h3>
          <Link href={`/entries/${entry.id}`}>
            {entry.title}
            <ArrowUpRight size={22} className="card-title-arrow" />
          </Link>
        </h3>
        <p className="card-excerpt">{entry.excerpt}</p>
        <div className="card-context">
          <MapPin size={12} />
          <span>{entry.place}</span>
          <span className="context-separator">·</span>
          <span>{entry.readingMinutes} min read</span>
        </div>
        <div className="card-footer">
          <span className="tried-count">
            <span className="little-avatars" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {entry.tried ? (
              <>
                <strong>{entry.tried}</strong> tried it
              </>
            ) : (
              "Your perspective could help"
            )}
          </span>
          <span className="card-comment">
            <MessageCircle size={14} /> {entry.comments}
          </span>
          <Link
            href={`/entries/${entry.id}`}
            className="card-open"
            aria-label={`Read ${entry.title}`}
          >
            <MoveUpRight size={17} />
          </Link>
        </div>
      </div>
    </article>
  );
}
