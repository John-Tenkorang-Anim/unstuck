"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, MessageCircleQuestion, Search } from "lucide-react";
import { OutcomeGlyph, type OutcomeKey } from "./glyph";

type Suggestion = {
  href: string;
  title: string;
  kind: string;
  outcome: OutcomeKey | null;
  field: string;
};

/**
 * The one box on the home page. Typing shows what others posted; Enter
 * searches; Ask posts the words as a question. Suggestions follow the ARIA
 * combobox pattern, so arrow keys and screen readers work as expected. As a
 * plain form it still searches or asks without JavaScript.
 */
export function HomeSearch({
  placeholder = "What are you trying to figure out?",
}: {
  placeholder?: string;
}) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [corrected, setCorrected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const data = await fetch(`/api/suggest?q=${encodeURIComponent(text)}`, {
          signal: controller.signal,
        }).then((r) => r.json());
        setItems(data.items);
        setCorrected(data.corrected);
        setActive(-1);
        setOpen(true);
      } catch {
        /* Typing again cancels the previous request. */
      }
    }, 140);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);
  const text = q.trim();
  // Two actions always follow the suggestions: search, or ask.
  const actions = text
    ? [
        { href: `/search?q=${encodeURIComponent(text)}`, label: "search" },
        {
          href: `/new?kind=problem&q=${encodeURIComponent(text)}`,
          label: "ask",
        },
      ]
    : [];
  const total = items.length + actions.length;
  const go = (index: number) => {
    const target =
      index < items.length
        ? items[index].href
        : actions[index - items.length]?.href;
    if (target) router.push(target);
  };
  const showList = open && text.length >= 2;
  return (
    <form
      className="home-search-box"
      action="/search"
      role="search"
      onSubmit={(event) => {
        if (active >= 0) {
          event.preventDefault();
          go(active);
        }
      }}
    >
      <div className={`home-bar ${showList ? "is-open" : ""}`}>
        <Search size={20} aria-hidden="true" />
        <input
          ref={box}
          type="search"
          name="q"
          role="combobox"
          aria-label="Search, or describe your problem"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-activedescendant={
            showList && active >= 0 ? `${id}-${active}` : undefined
          }
          placeholder={placeholder}
          autoComplete="off"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(event) => {
            if (!showList || !total) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((a) => (a + 1) % total);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((a) => (a <= 0 ? total - 1 : a - 1));
            } else if (event.key === "Escape") {
              setOpen(false);
              setActive(-1);
            }
          }}
        />
        {/* Search comes first so pressing Enter searches. */}
        <button className="button button-dark">Search</button>
        <button
          className="button button-outline home-ask"
          formAction="/new"
          name="kind"
          value="problem"
        >
          Ask
        </button>
      </div>
      {showList && (
        <ul className="suggest-list" id={`${id}-list`} role="listbox">
          {corrected && (
            <li className="suggest-note" role="presentation">
              Showing matches for <b>{corrected}</b>
            </li>
          )}
          {items.map((item, i) => (
            <li
              key={item.href}
              id={`${id}-${i}`}
              role="option"
              aria-selected={active === i}
              className="suggest-item"
              onMouseDown={(event) => {
                event.preventDefault();
                go(i);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {item.outcome ? (
                <OutcomeGlyph outcome={item.outcome} size={13} />
              ) : (
                <ArrowUpRight size={13} aria-hidden="true" />
              )}
              <span className="suggest-title">{item.title}</span>
              <span className="suggest-kind">
                {item.kind} · {item.field}
              </span>
            </li>
          ))}
          {!items.length && (
            <li className="suggest-note" role="presentation">
              Nobody has posted this yet. Ask it, and people who’ve been there
              will see it.
            </li>
          )}
          {actions.map((action, j) => {
            const i = items.length + j;
            return (
              <li
                key={action.label}
                id={`${id}-${i}`}
                role="option"
                aria-selected={active === i}
                className={`suggest-item suggest-action is-${action.label}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  go(i);
                }}
                onMouseEnter={() => setActive(i)}
              >
                {action.label === "ask" ? (
                  <MessageCircleQuestion size={14} aria-hidden="true" />
                ) : (
                  <Search size={14} aria-hidden="true" />
                )}
                <span className="suggest-title">
                  {action.label === "ask" ? "Ask " : "See all results for "}“
                  {text}”
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </form>
  );
}
