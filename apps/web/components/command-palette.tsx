"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, CornerDownLeft, Search } from "lucide-react";
import { topics } from "@/lib/data";
import type { Outcome } from "@/lib/types";
import { OutcomeGlyph } from "./glyph";

type IndexEntry = {
  id: string;
  title: string;
  topic: string;
  outcome: Outcome | null;
};
type Command = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  href: string;
  outcome?: Outcome | "open";
};
const fixed: Command[] = [
  { id: "discover", group: "Go to", label: "Discover", href: "/" },
  {
    id: "questions",
    group: "Go to",
    label: "Open questions",
    href: "/questions",
  },
  { id: "notebook", group: "Go to", label: "Your notebook", href: "/notebook" },
  { id: "about", group: "Go to", label: "How Unstuck works", href: "/about" },
  { id: "new", group: "Create", label: "Leave a field note", href: "/new" },
  {
    id: "ask",
    group: "Create",
    label: "Ask a question",
    href: "/new?kind=problem",
  },
  ...topics.map((topic) => ({
    id: `field-${topic}`,
    group: "Fields",
    label: topic,
    href: `/?topic=${encodeURIComponent(topic)}#discover`,
  })),
];
let cached: IndexEntry[] | undefined;

export default function CommandPalette({
  open,
  onOpenChange,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus: React.RefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const id = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [entries, setEntries] = useState<IndexEntry[]>(cached ?? []);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || cached) return;
    let live = true;
    fetch("/search-index")
      .then((response) => (response.ok ? response.json() : { entries: [] }))
      .then((data: { entries: IndexEntry[] }) => {
        cached = data.entries;
        if (live) setEntries(data.entries);
      })
      .catch(() => {
        /* Navigation commands still work without the entry index. */
      });
    return () => {
      live = false;
    };
  }, [open]);
  useEffect(() => {
    if (open) return;
    setQuery("");
    setActive(0);
  }, [open]);
  const results = useMemo(() => {
    const all: Command[] = [
      ...entries.map((entry) => ({
        id: `entry-${entry.id}`,
        group: "Entries",
        label: entry.title,
        hint: entry.topic,
        href: `/entries/${entry.id}`,
        outcome: entry.outcome ?? ("open" as const),
      })),
      ...fixed,
    ];
    const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const matches = all.filter((command) =>
      terms.every((term) =>
        `${command.label} ${command.hint ?? ""} ${command.group}`
          .toLocaleLowerCase()
          .includes(term),
      ),
    );
    return terms.length
      ? matches
      : matches.filter((c) => c.group !== "Entries");
  }, [entries, query]);
  const current = Math.min(active, Math.max(0, results.length - 1));
  useEffect(() => {
    list.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView?.({ block: "nearest" });
  }, [current, results]);
  function run(command?: Command) {
    if (!command) return;
    onOpenChange(false);
    router.push(command.href);
  }
  function move(event: React.KeyboardEvent) {
    if (!results.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      run(results[current]);
    }
  }
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="palette-overlay" />
        <Dialog.Content
          className="palette"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus({ preventScroll: true });
          }}
        >
          <Dialog.Title className="sr-only">Search Unstuck</Dialog.Title>
          <div className="palette-input">
            <Search size={17} aria-hidden="true" />
            <input
              autoFocus
              role="combobox"
              aria-label="Search entries, fields and pages"
              aria-expanded="true"
              aria-controls={`${id}-list`}
              aria-activedescendant={
                results.length ? `${id}-${current}` : undefined
              }
              autoComplete="off"
              spellCheck={false}
              placeholder="Search entries, fields and pages"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={move}
            />
            <kbd>esc</kbd>
          </div>
          <div
            className="palette-list"
            id={`${id}-list`}
            role="listbox"
            aria-label="Results"
            ref={list}
          >
            {results.map((command, index) => (
              <div
                key={command.id}
                id={`${id}-${index}`}
                role="option"
                aria-selected={index === current}
                className="palette-option"
                onMouseMove={() => setActive(index)}
                onClick={() => run(command)}
              >
                {index === 0 || results[index - 1].group !== command.group ? (
                  <span className="palette-group">{command.group}</span>
                ) : null}
                <span className="palette-line">
                  {command.outcome ? (
                    <OutcomeGlyph outcome={command.outcome} />
                  ) : (
                    <ArrowRight size={14} aria-hidden="true" />
                  )}
                  <span className="palette-label">{command.label}</span>
                  {command.hint && <small>{command.hint}</small>}
                  {index === current && (
                    <CornerDownLeft size={13} aria-hidden="true" />
                  )}
                </span>
              </div>
            ))}
            {!results.length && (
              <p className="palette-empty" role="status">
                Nothing matches that yet.
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
