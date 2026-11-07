"use client";
import * as Popover from "@radix-ui/react-popover";
import Link from "next/link";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  ViewTransition,
} from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Atlas, type AtlasSelection } from "./atlas";
import { EntryTile } from "./entry-card";
import { OutcomeGlyph, type OutcomeKey } from "./glyph";
import { topics } from "@/lib/data";
import type { EntrySummary as Entry, Notebook } from "@/lib/types";
import { useNotebook } from "./notebook-provider";

type Tab = "all" | OutcomeKey;
const tabs: [Tab, string][] = [
  ["all", "Everything"],
  ["worked", "What worked"],
  ["failed", "What didn’t"],
  ["mixed", "Mixed"],
  ["ongoing", "Still learning"],
  ["open", "Still open"],
];
function isTab(value: string): value is Tab {
  return tabs.some(([tab]) => tab === value);
}
const matchesTab = (entry: Entry, tab: Tab) =>
  tab === "all" || (entry.outcome ?? "open") === tab;

export function Discovery({
  notebook,
  initialTopic = "",
  initialQuery = "",
  initialOutcome = "",
  questions = false,
  savedOnly = false,
}: {
  notebook: Notebook;
  initialTopic?: string;
  initialQuery?: string;
  initialOutcome?: string;
  questions?: boolean;
  savedOnly?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [topic, setTopic] = useState(initialTopic);
  const [tab, setTab] = useState<Tab>(
    isTab(initialOutcome) ? initialOutcome : "all",
  );
  const [sort, setSort] = useState("recent");
  const [filters, setFilters] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const { saved, ready } = useNotebook();
  const home = !savedOnly && !questions;
  useEffect(() => {
    setTopic(initialTopic);
  }, [initialTopic]);
  useEffect(() => {
    setTab(isTab(initialOutcome) ? initialOutcome : "all");
  }, [initialOutcome]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) &&
        !target.isContentEditable
      ) {
        event.preventDefault();
        search.current?.focus();
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const scoped = useMemo(() => {
    const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return notebook.entries.filter(
      (entry) =>
        (!savedOnly || saved.includes(entry.id)) &&
        (!questions || entry.kind === "problem") &&
        (!topic || entry.topic === topic) &&
        terms.every((term) =>
          `${entry.title} ${entry.excerpt} ${entry.topic} ${entry.place}`
            .toLocaleLowerCase()
            .includes(term),
        ),
    );
  }, [notebook.entries, query, topic, savedOnly, questions, saved]);
  const entries = useMemo(
    () =>
      scoped
        .filter((entry) => matchesTab(entry, tab))
        .sort((a, b) =>
          sort === "tried" ? b.tried - a.tried : b.date.localeCompare(a.date),
        ),
    [scoped, tab, sort],
  );
  const totals = useMemo(
    () => ({
      tried: notebook.entries.reduce((sum, entry) => sum + entry.tried, 0),
      helped: notebook.entries.reduce((sum, entry) => sum + entry.helped, 0),
      places: new Set(notebook.entries.map((entry) => entry.place)).size,
    }),
    [notebook.entries],
  );
  const tabCounts = Object.fromEntries(
    tabs.map(([value]) => [
      value,
      scoped.filter((entry) => matchesTab(entry, value)).length,
    ]),
  ) as Record<Tab, number>;
  /** Filter changes run as transitions, so surviving rows glide into place. */
  function glide(change: () => void) {
    startTransition(change);
  }
  function reset() {
    setQuery("");
    setTopic("");
    setTab("all");
  }
  function select(selection: AtlasSelection) {
    glide(() => {
      setTopic(selection.topic);
      setTab(selection.outcome);
    });
    const params = new URLSearchParams();
    if (selection.topic) params.set("topic", selection.topic);
    if (selection.outcome !== "all") params.set("outcome", selection.outcome);
    const text = params.toString();
    window.history.replaceState(
      null,
      "",
      `/${text ? `?${text}` : ""}#discover`,
    );
    document.getElementById("discover")?.scrollIntoView?.();
  }
  return (
    <>
      {home ? (
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy frame">
            <p className="hero-kicker">Everything the world has tried</p>
            <h1 id="hero-title">
              Someone’s been <span className="tint-worked">where you are.</span>
            </h1>
            <p className="hero-lede">
              <strong className="tint-worked">What worked</strong>,{" "}
              <strong className="tint-failed">what didn’t</strong>, and{" "}
              <strong className="tint-ongoing">why</strong>. Every entry keeps
              the conditions it happened in, so you can judge whether it would
              work for you.
            </p>
            <div className="hero-actions">
              <a className="button button-dark" href="#discover">
                See what people tried
              </a>
              <Link className="text-link" href="/about">
                How it works <ChevronRight size={15} />
              </Link>
            </div>
          </div>
          {notebook.mode !== "unavailable" && (
            <div className="hero-stage frame">
              <div className="stage-tile">
                <Atlas
                  entries={notebook.entries}
                  topic={topic}
                  outcome={tab}
                  onSelect={select}
                />
                <dl className="readout">
                  <div>
                    <dt>Entries</dt>
                    <dd>{notebook.entries.length}</dd>
                  </div>
                  <div>
                    <dt>People tried them</dt>
                    <dd>{totals.tried}</dd>
                  </div>
                  <div>
                    <dt>Found them useful</dt>
                    <dd>{totals.helped}</dd>
                  </div>
                  <div>
                    <dt>Places</dt>
                    <dd>{totals.places}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="page-head frame">
          <p className="label">
            {savedOnly ? "Private to this device" : "No result yet"}
          </p>
          <h1>
            {savedOnly ? (
              <>
                Good things,{" "}
                <span className="tint-worked">kept for later.</span>
              </>
            ) : (
              <>
                A little stuck?{" "}
                <span className="tint-worked">You’re in good company.</span>
              </>
            )}
          </h1>
          <p className="page-lede">
            {savedOnly
              ? "The entries you want to return to. Saved only in this browser."
              : "An unfinished story is an invitation. Bring a fresh perspective, a useful question, or something you’ve tried."}
          </p>
          {questions && (
            <Link href="/new?kind=problem" className="button button-dark">
              Ask your question <ArrowUpRight size={15} />
            </Link>
          )}
        </section>
      )}
      <section
        id="discover"
        className="ledger frame"
        aria-labelledby="discovery-heading"
      >
        <div className="ledger-title">
          <h2 id="discovery-heading">
            {savedOnly
              ? "Your notebook"
              : questions
                ? "Questions worth exploring"
                : "Stories worth learning from"}
          </h2>
          {notebook.mode === "examples" && (
            <p className="example-notice">
              <span className="example-tag">Sample data</span> Fictional stories
              to explore what’s possible.
            </p>
          )}
        </div>
        <div className="ledger-controls">
          <form
            className="search-field"
            onSubmit={(e) => e.preventDefault()}
            role="search"
          >
            <Search size={16} aria-hidden="true" />
            <input
              ref={search}
              type="search"
              aria-label="Search the notebook"
              placeholder="What are you trying to figure out?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd aria-hidden="true">/</kbd>
          </form>
          <Popover.Root open={filters} onOpenChange={setFilters}>
            <Popover.Trigger
              className={`button button-outline ${topic ? "is-active" : ""}`}
            >
              <SlidersHorizontal size={14} /> Fields
              {topic && <span className="filter-count">1</span>}
              <ChevronDown size={13} />
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="filter-popover"
                align="end"
                sideOffset={6}
                aria-label="Filter by field"
              >
                {["", ...topics].map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      glide(() => setTopic(item));
                      setFilters(false);
                    }}
                    aria-pressed={topic === item}
                  >
                    <span>{item || "Every field"}</span>
                    {topic === item && <Check size={14} />}
                  </button>
                ))}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          <label className="sort-control">
            <span className="sr-only">Sort entries</span>
            <select
              value={sort}
              onChange={(e) => glide(() => setSort(e.target.value))}
            >
              <option value="recent">Newest</option>
              <option value="tried">Most tried</option>
            </select>
            <ChevronDown size={13} aria-hidden="true" />
          </label>
        </div>
        {!questions && (
          <OutcomeTabs
            value={tab}
            counts={tabCounts}
            onChange={(next) => glide(() => setTab(next))}
          />
        )}
        {topic && (
          <div className="active-filter">
            <span className="label">Field</span>
            <button onClick={() => setTopic("")}>
              {topic}
              <X size={12} aria-hidden="true" />
              <span className="sr-only">, remove this filter</span>
            </button>
          </div>
        )}
        {notebook.mode === "unavailable" ? (
          <div className="empty-state">
            <h3>The notebook is taking a moment.</h3>
            <p>
              We couldn’t reach the shared notebook. Please try again shortly.
            </p>
            <a href="/" className="button button-dark">
              Try again <ArrowRight size={15} />
            </a>
          </div>
        ) : savedOnly && !ready ? (
          <div className="empty-state" aria-busy="true">
            <p>Opening your notebook…</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="empty-state">
            <h3>
              {savedOnly && !query && !topic
                ? "Make room for a little inspiration."
                : "A new direction is waiting."}
            </h3>
            <p>
              {savedOnly && !query && !topic
                ? "Select the bookmark on any entry to keep it here. Your collection stays on this device."
                : "Nothing matches these filters. Try a broader question or another field."}
            </p>
            {savedOnly && !query && !topic ? (
              <Link href="/" className="button button-dark">
                Find your first entry <ArrowRight size={15} />
              </Link>
            ) : (
              <button className="button button-dark" onClick={reset}>
                Clear filters <ArrowRight size={15} />
              </button>
            )}
          </div>
        ) : (
          <div className="tiles">
            {entries.map((entry, index) => {
              const featured = entries.length >= 3;
              const size =
                featured && index === 0
                  ? "lead"
                  : featured && index < 3
                    ? "side"
                    : "standard";
              const rest = featured ? entries.length - 3 : entries.length;
              const position = featured ? index - 3 : index;
              const lastRow = rest % 3;
              const span =
                size !== "standard"
                  ? undefined
                  : lastRow && position >= rest - lastRow
                    ? 12 / lastRow
                    : 4;
              return (
                <ViewTransition key={entry.id} name={`row-${entry.id}`}>
                  <EntryTile entry={entry} size={size} span={span} />
                </ViewTransition>
              );
            })}
          </div>
        )}
        <p className="ledger-end" role="status" aria-live="polite">
          {entries.length
            ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"} shown`
            : "No entries shown"}
        </p>
      </section>
      {!savedOnly && (
        <section className="contribute-banner">
          <div className="frame contribute-inner">
            <h2>
              What have you <span className="tint-invert">learned lately?</span>
            </h2>
            <div>
              <p>
                A small win, a wrong turn, or an idea you can’t stop thinking
                about. It could be the start of someone else’s way forward.
              </p>
              <Link href="/new" className="button button-invert">
                Leave a field note <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
/** An Apple-style segmented control: the thumb slides to the selected option. */
function OutcomeTabs({
  value,
  counts,
  onChange,
}: {
  value: Tab;
  counts: Record<Tab, number>;
  onChange: (tab: Tab) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; width: number } | null>(null);
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    function measure() {
      const selected = element?.querySelector<HTMLElement>(
        '[aria-pressed="true"]',
      );
      if (selected)
        setThumb({ x: selected.offsetLeft, width: selected.offsetWidth });
    }
    measure();
    // On phones the control scrolls sideways: keep the selection in view.
    element.scrollTo?.({
      left:
        (element.querySelector<HTMLElement>('[aria-pressed="true"]')
          ?.offsetLeft ?? 0) - 8,
    });
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);
  return (
    <div
      ref={track}
      className={`outcome-tabs ${thumb ? "has-thumb" : ""}`}
      role="group"
      aria-label="Filter by outcome"
    >
      {thumb && (
        <span
          className="tab-thumb"
          aria-hidden="true"
          style={{
            width: thumb.width,
            transform: `translateX(${thumb.x}px)`,
          }}
        />
      )}
      {tabs.map(([tab, label]) => (
        <button
          key={tab}
          aria-pressed={value === tab}
          onClick={() => onChange(tab)}
        >
          {tab !== "all" && <OutcomeGlyph outcome={tab} size={12} />}
          {label}
          <span className="tab-count" aria-hidden="true">
            {counts[tab]}
          </span>
        </button>
      ))}
    </div>
  );
}
