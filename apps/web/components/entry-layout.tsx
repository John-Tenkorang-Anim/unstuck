"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { MessagesSquare, PanelLeftClose } from "lucide-react";

const number = (n: number) => n.toLocaleString("en");

/**
 * The note reads on its own. The discussion opens beside it, on the left, only
 * when someone asks for it. The address keeps `?discuss=1` so the open state
 * can be shared and works without JavaScript.
 */
export function EntryLayout({
  initialOpen,
  discussion,
  children,
  stats,
}: {
  initialOpen: boolean;
  discussion: ReactNode;
  children: ReactNode;
  stats: {
    responses: number;
    explanations: number;
    unanswered: number;
    fresh?: number;
  };
}) {
  const [open, setOpen] = useState(initialOpen);
  const pane = useRef<HTMLElement>(null);
  const opener = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    // Older links point straight at the discussion with #why.
    if (location.hash === "#why") setOpen(true);
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
        : opener.current?.focus({ preventScroll: true }),
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
  const summary = [
    stats.responses
      ? `${number(stats.responses)} ${stats.responses === 1 ? "response" : "responses"}`
      : "No responses yet",
    stats.explanations
      ? `${number(stats.explanations)} ${stats.explanations === 1 ? "explanation" : "explanations"}`
      : "",
  ].filter(Boolean);
  return (
    <div className={`entry-layout ${open ? "is-discussing" : ""}`}>
      <aside
        ref={pane}
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
        {children}
        {!open && (
          <div className="disc-launch-dock">
            <a
              ref={opener}
              href="?discuss=1"
              className="disc-launch"
              aria-expanded={false}
              onClick={(event) => {
                event.preventDefault();
                toggle(true);
              }}
            >
              <MessagesSquare size={17} aria-hidden="true" />
              <span className="disc-launch-label">
                <strong>Discussion</strong>
                <span>{summary.join(" · ")}</span>
              </span>
              {stats.fresh ? (
                <span className="disc-launch-badge">
                  {number(stats.fresh)} new
                </span>
              ) : stats.unanswered ? (
                <span className="disc-launch-badge">
                  {number(stats.unanswered)} unanswered
                </span>
              ) : null}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
