"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Compass,
  Menu,
  Moon,
  Plus,
  Search,
  Sun,
  Target,
  UserRound,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  ViewTransition,
  type ReactNode,
} from "react";
import { AccountChip } from "./account-chip";
import { Notifications } from "./notifications";
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
  const { lite, toggleLite } = useNotebook();
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
  const under = (...roots: string[]) =>
    roots.some((r) => path === r || path.startsWith(`${r}/`));
  // Five destinations. Records open under the section they belong to.
  const navigation = [
    {
      label: "Discover",
      href: "/discover",
      active: under("/discover", "/search", "/entries", "/communities"),
    },
    {
      label: "Problems",
      href: "/problems",
      active: under(
        "/problems",
        "/improvements",
        "/tests",
        "/analyze",
        "/questions",
      ),
    },
    {
      label: "Workspaces",
      href: "/workspaces",
      active: under("/workspaces", "/sessions"),
    },
    { label: "Lessons", href: "/lessons", active: under("/lessons") },
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
        <div className="topbar-actions">
          <Link
            href="/new"
            className="button button-dark contribute-button"
            aria-current={path === "/new" ? "page" : undefined}
          >
            <Plus size={15} aria-hidden="true" /> Contribute
          </Link>
          <button
            className="icon-button"
            onClick={showPalette}
            aria-label="Search (⌘K)"
            title="Search (⌘K)"
          >
            <Search size={17} />
          </button>
          <Notifications />
          <ThemeButton />
          <AccountChip />
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
              <Link
                href="/notebook"
                className="nav-item"
                onClick={() => setOpen(false)}
              >
                My Space
              </Link>
              <Link
                href="/activity"
                className="nav-item"
                onClick={() => setOpen(false)}
              >
                Activity
              </Link>
            </nav>
          </aside>
        </>
      )}
      <main id="main" tabIndex={-1} inert={open || undefined}>
        <ViewTransition>{children}</ViewTransition>
      </main>
      <nav
        className="tabbar"
        aria-label="Quick navigation"
        inert={open || undefined}
      >
        {(
          [
            [
              "/discover",
              "Discover",
              Compass,
              under("/discover", "/search", "/entries", "/communities"),
            ],
            [
              "/problems",
              "Problems",
              Target,
              under("/problems", "/improvements", "/tests", "/analyze"),
            ],
            ["/new", "Contribute", Plus, path === "/new"],
            ["/activity", "Activity", Bell, under("/activity")],
            [
              "/notebook",
              "My Space",
              UserRound,
              under("/notebook", "/account", "/people"),
            ],
          ] as const
        ).map(([href, label, Icon, active]) => (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            data-primary={href === "/new" || undefined}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <footer className="site-footer" inert={open || undefined}>
        <div className="frame site-footer-inner">
          <span className="brand brand-quiet">
            <LogoMark size={18} /> Unstuck
          </span>
          <p>Learn from what didn’t work. Build what works next.</p>
          <nav aria-label="Footer">
            <button className="footer-toggle" onClick={toggleLite}>
              Light reading: {lite ? "on" : "off"}
            </button>
            <Link href="/about">About</Link>
            <Link href="/about#principles">Principles</Link>
            <Link href="/lessons">Lessons</Link>
            <Link href="/workspaces">Workspaces</Link>
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
