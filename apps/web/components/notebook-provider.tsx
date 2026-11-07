"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type NotebookState = {
  saved: string[];
  toggleSaved: (id: string) => void;
  ready: boolean;
  lite: boolean;
  toggleLite: () => void;
  notice: (message: string) => void;
};
import type { ReadingMode } from "@/lib/media/reading-policy";

const Context = createContext<NotebookState | null>(null);
export function NotebookProvider({
  children,
  initialLite = false,
  initialMode = "auto",
}: {
  children: ReactNode;
  initialLite?: boolean;
  initialMode?: ReadingMode;
}) {
  const [saved, setSaved] = useState<string[]>([]);
  const [lite, setLite] = useState(initialLite);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem("unstuck:saved") ?? "[]",
      );
      if (Array.isArray(value))
        setSaved(value.filter((v): v is string => typeof v === "string"));
    } catch {
      /* Bookmarks must not block reading or network preferences. */
    }
    let preference: string | null = null;
    try {
      preference = localStorage.getItem("unstuck:lite");
    } catch {
      /* Use request/network hints. */
    }
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (initialMode === "auto")
      setLite(
        preference === "true" || preference === "false"
          ? preference === "true"
          : initialLite ||
              !!connection?.saveData ||
              ["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? ""),
      );
    setReady(true);
  }, [initialLite, initialMode]);
  useEffect(() => {
    document.documentElement.dataset.lite = String(lite);
  }, [lite]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [message]);
  const notice = useCallback((text: string) => setMessage(text), []);
  function toggleSaved(id: string) {
    const exists = saved.includes(id);
    const next = exists ? saved.filter((item) => item !== id) : [...saved, id];
    setSaved(next);
    try {
      localStorage.setItem("unstuck:saved", JSON.stringify(next));
    } catch {
      setMessage(
        "Browser storage is unavailable. Your changes will last for this visit.",
      );
      return;
    }
    setMessage(
      exists
        ? "Removed from your notebook"
        : "A little knowledge, kept for later.",
    );
  }
  function toggleLite() {
    const next = !lite;
    setLite(next);
    try {
      document.cookie = `unstuck-reading=${next ? "lite" : "full"}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    } catch {
      /* The current visit can still change reading mode. */
    }
    try {
      localStorage.setItem("unstuck:lite", String(next));
    } catch {
      /* The current reading preference still works for this visit. */
    }
  }
  return (
    <Context.Provider
      value={{ saved, toggleSaved, ready, lite, toggleLite, notice }}
    >
      {children}
      <div
        role="status"
        aria-live="polite"
        className={`toast ${message ? "toast-visible" : ""}`}
      >
        {message}
      </div>
    </Context.Provider>
  );
}
export function useNotebook() {
  const context = useContext(Context);
  if (!context) throw new Error("NotebookProvider is required");
  return context;
}
