"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Maximize2,
  MessagesSquare,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const number = (n: number) => n.toLocaleString("en");
const storeKey = "unstuck:pane-width";
/** The pane never squeezes the note below a readable column. */
const limits = () => ({
  min: 360,
  max: Math.max(360, Math.min(960, window.innerWidth - 480)),
});
const defaultWidth = () =>
  Math.round(Math.min(600, Math.max(420, window.innerWidth * 0.38)));

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
  const [width, setWidth] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  // Apply the chosen width to the page, so the footer makes room as well.
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(storeKey));
      if (saved) setWidth(saved);
    } catch {
      /* The default width works without storage. */
    }
  }, []);
  useEffect(() => {
    if (width === null) return;
    const { min, max } = limits();
    const value = Math.min(max, Math.max(min, width));
    document.documentElement.style.setProperty("--pane", `${value}px`);
    try {
      localStorage.setItem(storeKey, String(value));
    } catch {
      /* Width lasts for this visit. */
    }
  }, [width]);
  useEffect(
    () => () => {
      document.documentElement.style.removeProperty("--pane");
    },
    [],
  );
  const current = () =>
    pane.current?.getBoundingClientRect().width ?? defaultWidth();
  const wide = width !== null && width >= limits().max - 8;
  function widen() {
    setWidth(wide ? defaultWidth() : limits().max);
  }
  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    document.body.dataset.resizing = "";
  }
  function drag(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const { min, max } = limits();
    setWidth(Math.min(max, Math.max(min, event.clientX)));
  }
  function stopDrag() {
    setDragging(false);
    delete document.body.dataset.resizing;
  }
  function resizeWithKeys(event: React.KeyboardEvent<HTMLDivElement>) {
    const { min, max } = limits();
    const step = event.shiftKey ? 96 : 32;
    const delta =
      event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
    if (!delta && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    // Work from the latest width, so quick repeated presses all count.
    setWidth((previous) => {
      const base = previous ?? current();
      const next =
        event.key === "Home" ? min : event.key === "End" ? max : base + delta;
      return Math.min(max, Math.max(min, next));
    });
  }
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
          <span className="disc-pane-actions">
            <button
              className="icon-button pane-widen"
              aria-pressed={wide}
              aria-label={
                wide ? "Make the discussion narrower" : "Widen the discussion"
              }
              title={wide ? "Narrower" : "Widen for writing"}
              onClick={widen}
            >
              {wide ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
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
          </span>
        </div>
        <div className="disc-pane-body">{discussion}</div>
        <div
          className="pane-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the discussion"
          aria-controls="discussion-pane"
          aria-valuemin={360}
          aria-valuemax={960}
          aria-valuenow={Math.round(width ?? 0) || undefined}
          title="Drag to resize. Double-click to widen."
          tabIndex={0}
          data-dragging={dragging || undefined}
          onPointerDown={startDrag}
          onPointerMove={drag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          onDoubleClick={widen}
          onKeyDown={resizeWithKeys}
        />
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
