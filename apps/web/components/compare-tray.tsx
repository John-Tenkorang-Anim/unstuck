"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bookmark, Link as LinkIcon, Scale, X } from "lucide-react";
import { useNotebook } from "./notebook-provider";

const key = "unstuck:compare";
const listeners = new Set<(ids: string[]) => void>();
function read(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
}
function write(ids: string[]) {
  try {
    sessionStorage.setItem(key, JSON.stringify(ids));
  } catch {
    /* Kept in memory for this page. */
  }
  listeners.forEach((l) => l(ids));
}
/** The attempts picked for comparison, shared by every card on the page. */
export function useCompare() {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    setIds(read());
    listeners.add(setIds);
    return () => {
      listeners.delete(setIds);
    };
  }, []);
  const toggle = (id: string) => {
    const now = read();
    write(
      now.includes(id) ? now.filter((x) => x !== id) : [...now, id].slice(-4),
    );
  };
  return { ids, toggle, clear: () => write([]) };
}

/** Save, compare and share, revealed on hover and always shown on touch. */
export function CardActions({ id, title }: { id: string; title: string }) {
  const { saved, toggleSaved, notice } = useNotebook();
  const { ids, toggle } = useCompare();
  const isSaved = saved.includes(id);
  const comparing = ids.includes(id);
  return (
    <div className="card-actions">
      <button
        aria-label={isSaved ? `Remove ${title} from saved` : `Save ${title}`}
        aria-pressed={isSaved}
        onClick={() => toggleSaved(id)}
      >
        <Bookmark size={15} fill={isSaved ? "currentColor" : "none"} />
      </button>
      <button
        aria-label={
          comparing ? `Remove ${title} from comparison` : `Compare ${title}`
        }
        aria-pressed={comparing}
        onClick={() => toggle(id)}
      >
        <Scale size={15} />
      </button>
      <button
        aria-label={`Copy link to ${title}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(
              `${location.origin}/entries/${id}`,
            );
            notice("Link copied.");
          } catch {
            notice("Open it to copy the link.");
          }
        }}
      >
        <LinkIcon size={15} />
      </button>
    </div>
  );
}

/** A small tray that appears once something is picked for comparison. */
export function CompareTray() {
  const { ids, clear } = useCompare();
  if (!ids.length) return null;
  return (
    <div className="compare-tray" role="region" aria-label="Comparison">
      <Scale size={16} aria-hidden="true" />
      <span>
        {ids.length} selected{ids.length < 2 ? ". Pick one more" : ""}
      </span>
      {ids.length >= 2 && (
        <Link
          className="button button-dark"
          href={`/analyze?ids=${ids.join(",")}`}
        >
          Compare
        </Link>
      )}
      <button
        className="icon-button"
        aria-label="Clear comparison"
        onClick={clear}
      >
        <X size={16} />
      </button>
    </div>
  );
}
