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
  Play,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Atlas, type AtlasSelection } from "./atlas";
import { SessionCard } from "./session-card";
import { clock } from "@/lib/search";
import type { Session } from "@/lib/sessions";
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
  sessions = [],
}: {
  notebook: Notebook;
  sessions?: Session[];
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
      `/discover${text ? `?${text}` : ""}#discover`,
    );
    document.getElementById("discover")?.scrollIntoView?.();
  }
  return (
    <>
      {home ? (
        <>
          <section className="home-search frame" aria-labelledby="hero-title">
            <h1 id="hero-title">
              Learn from <span className="tint-brand">what failed.</span>
            </h1>
            <p className="home-lede">
              Search attempts, photos and film, down to the second something
              went wrong.
            </p>
            <form className="home-bar" action="/search" role="search">
              <Search size={20} aria-hidden="true" />
              <input
                ref={search}
                type="search"
                name="q"
                aria-label="Search the notebook"
                placeholder="What are you trying to figure out?"
                autoComplete="off"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <kbd aria-hidden="true">/</kbd>
              <button className="button button-dark">Search</button>
            </form>
            <nav className="home-types" aria-label="Search by type">
              {[
                ["videos", "Videos"],
                ["photos", "Photos"],
                ["failures", "Failures"],
                ["fixes", "Fixes"],
                ["research", "Research"],
                ["critique", "Critique"],
              ].map(([key, label]) => (
                <Link key={key} href={`/search?type=${key}`}>
                  {label}
                </Link>
              ))}
            </nav>
          </section>
          <Showcase entries={notebook.entries} sessions={sessions} />
        </>
      ) : (
        <section className="page-head frame">
          <p className="label">
            {savedOnly ? "Private to this device" : "No result yet"}
          </p>
          <h1>
            {savedOnly ? (
              <>
                Good things, <span className="tint-brand">kept for later.</span>
              </>
            ) : (
              <>
                A little stuck?{" "}
                <span className="tint-brand">You’re in good company.</span>
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
                : "Latest attempts"}
          </h2>
          {notebook.mode === "examples" && (
            <p className="example-notice">
              <span className="example-tag">Sample data</span> Fictional stories
              and one historical case. Photos and film are real.
            </p>
          )}
        </div>
        <div className="ledger-controls">
          {!home && (
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
          )}
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
            <a href="/discover" className="button button-dark">
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
              <Link href="/discover" className="button button-dark">
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
      {home && notebook.mode !== "unavailable" && (
        <section className="hero-stage frame" aria-label="The map of attempts">
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
        </section>
      )}
      {!savedOnly && (
        <section className="contribute-banner">
          <div className="frame contribute-inner">
            <h2>
              Post the one that <span className="tint-star">didn’t work.</span>
            </h2>
            <div>
              <p>
                Somebody is about to try the same thing. A photo, a minute of
                video and an honest account will save them the trouble.
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

/** The home page's media layer: film with marked failures, and open critique. */
function Showcase({
  entries,
  sessions,
}: {
  entries: Entry[];
  sessions: Session[];
}) {
  const filmed = entries.filter((entry) => entry.clip);
  if (!filmed.length && !sessions.length) return null;
  return (
    <div className="showcase frame">
      {filmed.slice(0, 1).map((entry) => {
        const clip = entry.clip!;
        return (
          <section
            key={entry.id}
            className="feature"
            aria-labelledby="feature-title"
          >
            <div className="feature-head">
              <h2 id="feature-title">Caught on camera</h2>
              <Link className="text-link" href="/search?type=videos">
                All videos <ChevronRight size={15} />
              </Link>
            </div>
            <div
              className="feature-card"
              data-outcome={entry.outcome ?? "open"}
            >
              <Link
                className="feature-media"
                href={`/entries/${entry.id}#clip`}
                aria-label={`Watch: ${clip.title}`}
              >
                <img
                  src={clip.poster?.src}
                  alt=""
                  width={clip.poster?.width}
                  height={clip.poster?.height}
                  loading="lazy"
                />
                <span className="feature-play">
                  <Play size={22} fill="currentColor" />
                </span>
                <span className="serp-time">{clock(clip.duration)}</span>
                <span className="feature-track" aria-hidden="true">
                  {clip.moments.map((m) => (
                    <i
                      key={m.at}
                      className={`timeline-mark mark-${m.kind}`}
                      style={{ left: `${(m.at / clip.duration) * 100}%` }}
                    />
                  ))}
                </span>
              </Link>
              <div className="feature-body">
                <p className="feature-meta">
                  {entry.topic} · {entry.place}
                </p>
                <p className="feature-title">
                  <Link href={`/entries/${entry.id}`}>{entry.title}</Link>
                </p>
                <p className="feature-excerpt">{entry.excerpt}</p>
                <ol className="feature-moments" aria-label="Marked moments">
                  {clip.moments
                    .filter((m) => m.kind === "broke")
                    .map((m) => (
                      <li key={m.at}>
                        <Link
                          href={`/entries/${entry.id}?t=${Math.floor(m.at)}#clip`}
                        >
                          <span className="moment-time">{clock(m.at)}</span>
                          <span>
                            <span className="moment-flag">Where it broke</span>
                            {m.label}
                          </span>
                        </Link>
                      </li>
                    ))}
                </ol>
              </div>
            </div>
          </section>
        );
      })}
      {sessions.length > 0 && (
        <section className="critique-shelf" aria-labelledby="critique-title">
          <div className="feature-head">
            <h2 id="critique-title">Open for critique</h2>
            <Link className="text-link" href="/sessions">
              All sessions <ChevronRight size={15} />
            </Link>
          </div>
          <ul className="session-cards">
            {sessions.slice(0, 3).map((session) => (
              <li key={session.id}>
                <SessionCard
                  session={session}
                  notes={session.rounds.flatMap((r) => r.notes).length}
                />
              </li>
            ))}
          </ul>
          <Link className="critique-cta" href="/sessions/new">
            <strong>Stuck on your own work?</strong>
            <span>
              Paste a photo, pin what went wrong, and ask for feedback.
            </span>
            <ChevronRight size={18} />
          </Link>
        </section>
      )}
    </div>
  );
}
