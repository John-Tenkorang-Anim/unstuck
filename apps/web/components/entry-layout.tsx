"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MessagesSquare, PanelLeftClose, PanelLeftOpen } from "lucide-react";

const number = (n: number) => n.toLocaleString("en");

/**
 * The note reads on its own. A bar pinned under the top bar holds one toggle
 * that opens the discussion beside the note, on the left, and closes it again.
 * The toggle never moves or disappears. The address keeps `?discuss=1` so the
 * open state can be shared and works without JavaScript.
 */
export function EntryLayout({
  initialOpen,
  discussion,
  children,
  title,
  stats,
}: {
  initialOpen: boolean;
  discussion: ReactNode;
  children: ReactNode;
  title: string;
  stats: {
    responses: number;
    explanations: number;
    unanswered: number;
    fresh?: number;
  };
}) {
  const [open, setOpen] = useState(initialOpen);
  const [scrolled, setScrolled] = useState(false);
  const pane = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    // Older links point straight at the discussion with #why.
    if (location.hash === "#why") setOpen(true);
    const onScroll = () => setScrolled(window.scrollY > 260);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  function toggle(next: boolean) {
    setOpen(next);
    const url = new URL(location.href);
    if (next) url.searchParams.set("discuss", "1");
    else url.searchParams.delete("discuss");
    url.hash = "";
    history.replaceState(history.state, "", url);
    requestAnimationFrame(() =>
      next
        ? pane.current?.focus({ preventScroll: true })
        : toggleRef.current?.focus({ preventScroll: true }),
    );
  }
  useEffect(() => {
    if (!open) return;
    function close(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        pane.current?.contains(document.activeElement) &&
        !(document.activeElement as HTMLElement)?.matches(
          "input, textarea, select",
        )
      )
        toggle(false);
    }
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  });
  const meta = [
    stats.explanations
      ? `${number(stats.explanations)} ${stats.explanations === 1 ? "explanation" : "explanations"}`
      : "",
    stats.unanswered
      ? `${number(stats.unanswered)} unanswered ${stats.unanswered === 1 ? "question" : "questions"}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className={`entry-layout ${open ? "is-discussing" : ""}`}>
      <aside
        ref={pane}
        id="discussion-pane"
        className="disc-pane"
        aria-label="Discussion"
        tabIndex={-1}
        hidden={!open}
      >
        <div className="disc-pane-bar">
          <span className="disc-pane-title">
            <MessagesSquare size={16} aria-hidden="true" /> Discussion
          </span>
          <a
            href="?"
            className="icon-button"
            aria-label="Close the discussion"
            title="Close the discussion"
            onClick={(event) => {
              event.preventDefault();
              toggle(false);
            }}
          >
            <PanelLeftClose size={17} />
          </a>
        </div>
        <div className="disc-pane-body">{discussion}</div>
      </aside>
      <div className="note-pane">
        <div className="note-bar" data-scrolled={scrolled || undefined}>
          <a
            ref={toggleRef}
            href={open ? "?" : "?discuss=1"}
            className="note-toggle"
            aria-expanded={open}
            aria-controls="discussion-pane"
            onClick={(event) => {
              event.preventDefault();
              toggle(!open);
            }}
          >
            {open ? (
              <PanelLeftClose size={16} aria-hidden="true" />
            ) : (
              <PanelLeftOpen size={16} aria-hidden="true" />
            )}
            {open ? "Hide discussion" : "Discussion"}
            <span className="note-toggle-count">
              {number(stats.responses)}
              <span className="sr-only">
                {stats.responses === 1 ? " response" : " responses"}
              </span>
            </span>
            {stats.fresh ? (
              <span className="note-toggle-new">{number(stats.fresh)} new</span>
            ) : null}
          </a>
          <span className="note-bar-title" aria-hidden="true">
            {title}
          </span>
          {meta && <span className="note-bar-meta">{meta}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}
