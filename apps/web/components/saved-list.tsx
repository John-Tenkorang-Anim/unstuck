"use client";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import { useNotebook } from "./notebook-provider";

/** What this person saved on this device, looked up against known records. */
export function SavedList({
  catalog,
  only,
  empty,
}: {
  catalog: Record<string, { label: string; href: string; kind: string }>;
  /** Only keys starting with this, such as "lesson:". */
  only?: string;
  empty: string;
}) {
  const { saved, toggleSaved, ready } = useNotebook();
  const items = saved
    .filter((k) => (only ? k.startsWith(only) : true))
    .map((k) => ({ k, ref: catalog[k] }))
    .filter((x) => x.ref);
  if (!ready) return null;
  if (!items.length) return <p className="quiet-line">{empty}</p>;
  return (
    <ul className="saved-list">
      {items.map(({ k, ref }) => (
        <li key={k}>
          <span className="claim-kind">{ref!.kind}</span>
          <Link href={ref!.href}>{ref!.label}</Link>
          <button
            className="icon-button"
            aria-label={`Remove ${ref!.label} from saved`}
            onClick={() => toggleSaved(k)}
          >
            <Bookmark size={15} fill="currentColor" />
          </button>
        </li>
      ))}
    </ul>
  );
}
