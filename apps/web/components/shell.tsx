"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  Bookmark,
  Compass,
  Feather,
  HelpCircle,
  Leaf,
  Menu,
  MoveUpRight,
  NotebookPen,
  Plus,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useNotebook } from "./notebook-provider";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Unstuck home">
      <span className="brand-mark" aria-hidden="true">
        <MoveUpRight size={22} strokeWidth={3} />
      </span>
      unstuck<span className="brand-period">.</span>
    </Link>
  );
}
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const { saved, lite, toggleLite } = useNotebook();
  useEffect(() => {
    setOpen(false);
  }, [path]);
  useEffect(() => {
    function close(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const navigation = [
    {
      label: "Discover",
      href: "/",
      icon: Compass,
      active: path === "/" || path.startsWith("/entries"),
    },
    {
      label: "Open questions",
      href: "/questions",
      icon: HelpCircle,
      active: path === "/questions",
    },
    {
      label: "Your notebook",
      href: "/notebook",
      icon: Bookmark,
      active: path === "/notebook",
    },
  ];
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-brand">
          <Brand />
        </div>
        <div className="topbar-middle">
          <span className="status-dot" /> A little wiser, together.
        </div>
        <div className="topbar-actions">
          <button
            className={`icon-button reading-button ${lite ? "is-active" : ""}`}
            title={
              lite
                ? "Turn off light reading mode"
                : "Turn on light reading mode"
            }
            aria-label="Light reading mode"
            aria-pressed={lite}
            onClick={toggleLite}
          >
            <Leaf size={19} />
          </button>
          <Link href="/new" className="button button-dark topbar-share">
            <Plus size={17} /> Share what you learned
          </Link>
          <button
            className="icon-button menu-button"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="sidebar"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}
      <aside id="sidebar" className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-label">A PLACE TO GET UNSTUCK</div>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${item.active ? "nav-active" : ""}`}
              aria-current={item.active ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.href === "/notebook" && saved.length > 0 && (
                <span className="nav-count">{saved.length}</span>
              )}
              {item.active && <span className="nav-active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <div className="sidebar-label">FOLLOW YOUR CURIOSITY</div>
        <nav aria-label="Fields of knowledge" className="topic-nav">
          {[
            ["Food & farming", "sage"],
            ["Making & fixing", "clay"],
            ["Software", "blue"],
            ["Everyday life", "yellow"],
            ["Research", "lavender"],
            ["Community", "rose"],
          ].map(([topic, color]) => (
            <Link
              key={topic}
              href={`/?topic=${encodeURIComponent(topic)}#discover`}
              onClick={() => setOpen(false)}
            >
              <span className={`topic-dot dot-${color}`} />
              {topic}
              <ArrowUpRight size={13} />
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link href="/about" className="sidebar-note">
            <span className="tiny-asterisk">✳</span>
            <strong>Progress doesn’t happen alone.</strong>
            <p>Your small discovery could be someone’s way forward.</p>
            <span className="text-link">
              Meet Unstuck <ArrowUpRight size={14} />
            </span>
          </Link>
          <div className="sidebar-foot">
            <span>
              <NotebookPen size={13} /> An open notebook for everyone.
            </span>
            <Link href="/about#principles">
              Our principles <ArrowUpRight size={11} />
            </Link>
          </div>
        </div>
      </aside>
      <main
        id="main"
        className="main-content"
        tabIndex={-1}
        inert={open || undefined}
      >
        {children}
      </main>
      <div className="mobile-create">
        <Link href="/new" aria-label="Create a field note">
          <Feather size={22} />
        </Link>
      </div>
    </>
  );
}
