"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf, Menu, Moon, Plus, Search, Sun, X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  ViewTransition,
  type ReactNode,
} from "react";
import { topics } from "@/lib/data";
import { AccountChip } from "./account-chip";
import { RecoveryDialog } from "./recovery-dialog";
import { LogoMark } from "./glyph";
import { useNotebook } from "./notebook-provider";

const CommandPalette = dynamic(() => import("./command-palette"), {
  ssr: false,
});

export function Brand() {
  return (
    <Link href="/discover" className="brand" aria-label="Unstuck home">
      <LogoMark />
      Unstuck
    </Link>
  );
}
function currentTheme() {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "dark" || chosen === "light") return chosen;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
function ThemeButton() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => setTheme(currentTheme()), []);
  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem("unstuck:theme", next);
    } catch {
      /* The theme still applies for this visit. */
    }
  }
  return (
    <button
      className="icon-button"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      onClick={toggle}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteUsed, setPaletteUsed] = useState(false);
  const paletteReturn = useRef<HTMLElement | null>(null);
  const drawer = useRef<HTMLElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const { saved, lite, toggleLite } = useNotebook();
  function showPalette() {
    paletteReturn.current = document.activeElement as HTMLElement | null;
    setPaletteUsed(true);
    setPaletteOpen(true);
  }
  useEffect(() => {
    setOpen(false);
  }, [path]);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        showPalette();
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = menu.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const items = () =>
      Array.from(
        drawer.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),[tabindex="0"]',
        ) ?? [],
      );
    items()[0]?.focus({ preventScroll: true });
    function trap(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const controls = items();
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", trap);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);
  const navigation = [
    {
      label: "Discover",
      href: "/discover",
      active: path === "/discover" || path.startsWith("/entries"),
    },
    {
      label: "Search & ask",
      href: "/search",
      active: path === "/search",
    },
    {
      label: "Communities",
      href: "/communities",
      active: path.startsWith("/communities"),
    },
    {
      label: "Critique",
      href: "/sessions",
      active: path.startsWith("/sessions"),
    },
    { label: "Notebook", href: "/notebook", active: path === "/notebook" },
  ];
  const links = navigation.map((item) => (
    <Link
      key={item.href}
      href={item.href}
      className="nav-item"
      aria-current={item.active ? "page" : undefined}
      onClick={() => setOpen(false)}
    >
      {item.label}
      {item.href === "/notebook" && saved.length > 0 && (
        <span className="nav-count">
          <span className="sr-only">, </span>
          {saved.length}
          <span className="sr-only"> saved</span>
        </span>
      )}
    </Link>
  ));
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar" inert={open || undefined}>
        <Brand />
        {!open && (
          <nav aria-label="Main navigation" className="topnav">
            {links}
          </nav>
        )}
        <button className="palette-trigger" onClick={showPalette}>
          <Search size={15} aria-hidden="true" />
          <span className="palette-trigger-label">Search everything</span>
          <span className="sr-only">, command palette</span>
          <kbd aria-hidden="true">⌘K</kbd>
        </button>
        <div className="topbar-actions">
          <button
            className={`icon-button ${lite ? "is-active" : ""}`}
            title={
              lite
                ? "Turn off light reading mode"
                : "Turn on light reading mode"
            }
            aria-label="Light reading mode"
            aria-pressed={lite}
            onClick={toggleLite}
          >
            <Leaf size={16} />
          </button>
          <ThemeButton />
          <AccountChip />
          <Link
            href="/new"
            className="button button-dark topbar-share"
            aria-label="Share what you learned"
            title="Share what you learned"
          >
            <Plus size={15} />
            <span className="share-label">New note</span>
          </Link>
          <button
            ref={menu}
            className="icon-button menu-button"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls={open ? "sidebar" : undefined}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>
      {open && (
        <>
          <button
            className="sidebar-backdrop"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
          />
          <aside
            ref={drawer}
            id="sidebar"
            className="sidebar"
            role="dialog"
            aria-modal="true"
            aria-labelledby="navigation-title"
          >
            <div className="sidebar-head">
              <span className="label" id="navigation-title">
                Navigate
              </span>
              <button
                className="icon-button"
                aria-label="Close navigation drawer"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <nav aria-label="Main navigation" className="sidebar-nav">
              {links}
            </nav>
            <span className="label">Fields</span>
            <nav aria-label="Fields of knowledge" className="sidebar-fields">
              {topics.map((topic) => (
                <Link
                  key={topic}
                  href={`/discover?topic=${encodeURIComponent(topic)}#discover`}
                  onClick={() => setOpen(false)}
                >
                  {topic}
                </Link>
              ))}
            </nav>
          </aside>
        </>
      )}
      <main id="main" tabIndex={-1} inert={open || undefined}>
        <ViewTransition>{children}</ViewTransition>
      </main>
      <footer className="site-footer" inert={open || undefined}>
        <div className="frame site-footer-inner">
          <span className="brand brand-quiet">
            <LogoMark size={18} /> Unstuck
          </span>
          <p>
            Everything the world has tried: what worked, what didn’t, and why.
          </p>
          <nav aria-label="Footer">
            <Link href="/about">About</Link>
            <Link href="/about#principles">Principles</Link>
            <Link href="/new">Contribute</Link>
          </nav>
        </div>
      </footer>
      <RecoveryDialog />
      {paletteUsed && (
        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          returnFocus={paletteReturn}
        />
      )}
    </>
  );
}
