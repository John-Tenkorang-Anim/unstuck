"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Compass,
  Filter,
  Search,
  Sparkles,
  Sprout,
  X,
} from "lucide-react";
import { EntryCard } from "./entry-card";
import { LearningLoop } from "./artwork";
import { topics } from "@/lib/data";
import type { Entry, Notebook } from "@/lib/types";
import { useNotebook } from "./notebook-provider";

type Tab = "all" | "worked" | "failed" | "questions";
export function Discovery({
  notebook,
  initialTopic = "",
  initialQuery = "",
  questions = false,
  savedOnly = false,
}: {
  notebook: Notebook;
  initialTopic?: string;
  initialQuery?: string;
  questions?: boolean;
  savedOnly?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [topic, setTopic] = useState(initialTopic);
  const [tab, setTab] = useState<Tab>(questions ? "questions" : "all");
  const [sort, setSort] = useState("recent");
  const [filters, setFilters] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const { saved, ready } = useNotebook();
  useEffect(() => {
    setTopic(initialTopic);
  }, [initialTopic]);
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
      if (event.key === "Escape") setFilters(false);
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  const entries = useMemo(() => {
    const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return notebook.entries
      .filter(
        (entry) =>
          (!savedOnly || saved.includes(entry.id)) &&
          (!topic || entry.topic === topic) &&
          (tab === "all" ||
            (tab === "questions"
              ? entry.kind === "problem"
              : entry.outcome === tab)) &&
          terms.every((term) =>
            `${entry.title} ${entry.excerpt} ${entry.topic} ${entry.place}`
              .toLocaleLowerCase()
              .includes(term),
          ),
      )
      .sort((a, b) =>
        sort === "tried" ? b.tried - a.tried : b.date.localeCompare(a.date),
      );
  }, [notebook.entries, query, topic, tab, sort, savedOnly, saved]);
  function reset() {
    setQuery("");
    setTopic("");
    setTab(questions ? "questions" : "all");
  }
  return (
    <div className="page-container">
      {!savedOnly && !questions ? (
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="tiny-cross">✳</span> THE WORLD’S OPEN NOTEBOOK
            </div>
            <h1 id="hero-title">
              Someone’s been
              <br />
              where{" "}
              <span className="hero-emphasis">
                you are.
                <svg
                  viewBox="0 0 320 16"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M4 11Q160-2 316 8" />
                </svg>
              </span>
            </h1>
            <p>
              What worked. What didn’t. And everything we learned.
              <br className="desktop-break" /> Real experiences to help you find
              your next way forward.
            </p>
            <a className="hero-link" href="#discover">
              Follow your curiosity <ArrowDown size={15} />
            </a>
          </div>
          <LearningLoop />
        </section>
      ) : (
        <section className="compact-hero">
          <div className="eyebrow">
            <span className="tiny-cross">✳</span>{" "}
            {savedOnly
              ? "YOUR OWN CORNER OF CURIOSITY"
              : "GOOD QUESTIONS MOVE US FORWARD"}
          </div>
          <h1>
            {savedOnly ? (
              <>
                Good things,
                <br />
                <em>kept for later.</em>
              </>
            ) : (
              <>
                A little stuck?
                <br />
                <em>You’re in good company.</em>
              </>
            )}
          </h1>
          <p>
            {savedOnly
              ? "The ideas you want to return to. Saved privately on this device."
              : "An unfinished story is an invitation. Bring a fresh perspective, a useful question, or something you’ve tried."}
          </p>
          {questions && (
            <Link href="/new?kind=problem" className="button button-dark">
              Ask your question <ArrowUpRight size={16} />
            </Link>
          )}
        </section>
      )}
      {!savedOnly && !questions && (
        <div className="principle-strip">
          <span>
            <span className="strip-symbol">↗</span> Progress is a shared
            experiment.
          </span>
          <span>
            <Check size={14} /> Experience over opinion
          </span>
          <span>
            <Sprout size={15} /> Context changes everything
          </span>
          <span>
            <Sparkles size={14} /> Every attempt counts
          </span>
        </div>
      )}
      <section
        id="discover"
        className="discovery-section"
        aria-labelledby="discovery-heading"
      >
        <div className="section-heading">
          <div>
            <span className="section-kicker">
              {savedOnly
                ? "THE PERSONAL COLLECTION"
                : questions
                  ? "THE NEXT CHAPTER IS OPEN"
                  : "SOMETHING TO SPARK YOUR NEXT STEP"}
            </span>
            <h2 id="discovery-heading">
              {savedOnly
                ? "Your notebook"
                : questions
                  ? "Questions worth exploring"
                  : "A world of things worth trying"}
              <span className="heading-star">✳</span>
            </h2>
          </div>
          {!savedOnly && (
            <Link href="/about" className="quiet-link">
              How this works <ArrowUpRight size={14} />
            </Link>
          )}
        </div>
        <div className="discovery-controls">
          <form
            className="search-field"
            onSubmit={(e) => e.preventDefault()}
            role="search"
          >
            <Search size={19} />
            <input
              ref={search}
              type="search"
              aria-label="Search the notebook"
              placeholder="What are you trying to figure out?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>/</kbd>
          </form>
          <div className="filter-anchor">
            <button
              className={`button button-outline filter-button ${topic ? "filter-active" : ""}`}
              aria-expanded={filters}
              aria-controls="field-filters"
              onClick={() => setFilters(!filters)}
            >
              <Filter size={16} /> Fields{" "}
              {topic && <span className="filter-count">1</span>}
              <ChevronDown size={14} />
            </button>
            {filters && (
              <div className="filter-popover" id="field-filters">
                <div className="popover-heading">
                  Follow a field
                  <button
                    className="icon-button"
                    onClick={() => setFilters(false)}
                    aria-label="Close field filters"
                  >
                    <X size={16} />
                  </button>
                </div>
                {["", ...topics].map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setTopic(item);
                      setFilters(false);
                    }}
                    className={topic === item ? "selected" : ""}
                  >
                    <span>{item || "Every field"}</span>
                    {topic === item && <Check size={15} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="feed-toolbar">
          <div
            className="feed-tabs"
            role="group"
            aria-label="Filter by outcome"
          >
            {(
              [
                ["all", "For the curious"],
                ["worked", "What worked"],
                ["failed", "What didn’t"],
                ["questions", "Open questions"],
              ] as [Tab, string][]
            )
              .filter(([value]) => !questions || value === "questions")
              .map(([value, label]) => (
                <button
                  key={value}
                  className={tab === value ? "tab-active" : ""}
                  aria-pressed={tab === value}
                  onClick={() => setTab(value)}
                >
                  {value === "all" && <Compass size={15} />}
                  {label}
                </button>
              ))}
          </div>
          <label className="sort-control">
            <span className="sr-only">Sort entries</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recent">Latest discoveries</option>
              <option value="tried">Most tried</option>
            </select>
            <ChevronDown size={13} />
          </label>
        </div>
        {topic && (
          <div className="active-filter">
            Exploring{" "}
            <button onClick={() => setTopic("")}>
              {topic}
              <X size={12} />
            </button>
          </div>
        )}
        {notebook.mode === "examples" && (
          <div className="example-notice">
            <span className="example-dot" /> A sample notebook <span>·</span>{" "}
            Fictional stories to explore what’s possible.
          </div>
        )}
        {notebook.mode === "unavailable" ? (
          <div className="empty-state">
            <Compass size={35} />
            <h3>The notebook is taking a moment.</h3>
            <p>
              We couldn’t reach the shared notebook. Please try again shortly.
            </p>
            <a href="/" className="button button-dark">
              Try again <ArrowRight size={16} />
            </a>
          </div>
        ) : savedOnly && !ready ? (
          <div className="empty-state" aria-busy="true">
            <p>Opening your notebook…</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="empty-state">
            <BookmarkDrawing />
            <h3>
              {savedOnly && !query && !topic
                ? "Make room for a little inspiration."
                : "A new direction is waiting."}
            </h3>
            <p>
              {savedOnly && !query && !topic
                ? "Tap the bookmark on any field note to keep it here. Your collection stays on this device."
                : "No field notes match these filters. Try a broader question or explore another field."}
            </p>
            {savedOnly && !query && !topic ? (
              <Link href="/" className="button button-dark">
                Find your first field note <ArrowRight size={16} />
              </Link>
            ) : (
              <button className="button button-dark" onClick={reset}>
                Clear filters <ArrowRight size={16} />
              </button>
            )}
          </div>
        ) : (
          <div
            className={`entry-grid ${entries.length === 1 ? "entry-grid-single" : ""}`}
          >
            {entries.map((entry: Entry, i: number) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                featured={
                  i === 0 && !questions && !savedOnly && entries.length > 2
                }
              />
            ))}
          </div>
        )}
        <div className="feed-end" role="status" aria-live="polite">
          <span />
          {entries.length
            ? `${entries.length} ${entries.length === 1 ? "story" : "stories"}. A few more ways forward.`
            : "There’s always something new to learn."}
          <span />
        </div>
      </section>
      <section className="contribute-banner">
        <div className="banner-symbol" aria-hidden="true">
          ↗
        </div>
        <div>
          <span className="section-kicker">
            YOU DON’T NEED TO HAVE ALL THE ANSWERS.
          </span>
          <h2>Just a story someone can learn from.</h2>
          <p>
            A small win. A wrong turn. An idea you can’t stop thinking about.
          </p>
        </div>
        <Link href="/new" className="button button-dark">
          Leave a field note <ArrowUpRight size={17} />
        </Link>
      </section>
      <footer className="page-footer">
        <span>Made of all the things we learn, together.</span>
        <Link href="/about">
          A little more about Unstuck <ArrowUpRight size={12} />
        </Link>
      </footer>
    </div>
  );
}
function BookmarkDrawing() {
  return (
    <svg
      width="46"
      height="54"
      viewBox="0 0 46 54"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 7h26v39L23 35 10 46V7Z"
        fill="#e4eddb"
        stroke="#7d916d"
        strokeWidth="1.5"
      />
      <path d="m18 19 5 5 8-9" stroke="#7d916d" strokeWidth="1.5" />
    </svg>
  );
}
