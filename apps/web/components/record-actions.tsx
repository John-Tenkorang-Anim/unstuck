"use client";
import * as Popover from "@radix-ui/react-popover";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { signInHref } from "@/lib/navigation";
import {
  Bell,
  BellRing,
  Bookmark,
  Check,
  Link as LinkIcon,
  Quote,
} from "lucide-react";
import { useNotebook } from "./notebook-provider";
import { postJson, useAccount } from "./use-account";

export interface Citation {
  title: string;
  author: string;
  date: string;
  path: string;
  license?: string;
  kind: string;
}

/** Save, follow, share and cite, consistent on every kind of record. */
export function RecordActions({
  save,
  follow,
  cite,
  children,
}: {
  /** The key used in the saved list, such as an entry id or "problem:id". */
  save?: string;
  follow?: { type: string; id: string; following: boolean; enabled: boolean };
  cite?: Citation;
  children?: ReactNode;
}) {
  return (
    <div className="record-actions">
      {children}
      {save && <SaveAction id={save} />}
      {follow && <FollowAction {...follow} />}
      <ShareAction />
      {cite && <CiteAction cite={cite} />}
    </div>
  );
}
export function SaveAction({ id }: { id: string }) {
  const { saved, toggleSaved } = useNotebook();
  const on = saved.includes(id);
  return (
    <button
      className="chip-action"
      aria-pressed={on}
      onClick={() => toggleSaved(id)}
    >
      <Bookmark size={14} fill={on ? "currentColor" : "none"} />
      {on ? "Saved" : "Save"}
    </button>
  );
}
function FollowAction({
  type,
  id,
  following,
  enabled,
}: {
  type: string;
  id: string;
  following: boolean;
  enabled: boolean;
}) {
  const { viewer } = useAccount();
  const { notice } = useNotebook();
  const router = useRouter();
  const [on, setOn] = useState(following);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    if (!enabled) return notice("Following needs a database.");
    if (!viewer) {
      notice("Choose a name first to follow updates.");
      return router.push(signInHref());
    }
    setBusy(true);
    try {
      await postJson("/api/follows", { type, id, on: !on });
      setOn(!on);
      notice(
        on ? "Unfollowed." : "Following. Updates will appear in Activity.",
      );
    } catch (e) {
      notice(e instanceof Error ? e.message : "That didn’t work.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      className="chip-action"
      aria-pressed={on}
      disabled={busy}
      onClick={toggle}
    >
      {on ? <BellRing size={14} /> : <Bell size={14} />}
      {on ? "Following" : "Follow"}
    </button>
  );
}
function ShareAction() {
  const { notice } = useNotebook();
  const [done, setDone] = useState(false);
  async function share() {
    try {
      await navigator.clipboard.writeText(location.href);
      setDone(true);
      notice("Link copied.");
    } catch {
      notice("Copy the address from your browser to share it.");
    }
  }
  return (
    <button className="chip-action" onClick={share}>
      {done ? <Check size={14} /> : <LinkIcon size={14} />}
      Share
    </button>
  );
}
/** A ready-to-paste citation with the record’s permanent address. */
export function CiteAction({
  cite,
  label = "Cite",
}: {
  cite: Citation;
  label?: string;
}) {
  const { notice } = useNotebook();
  const [open, setOpen] = useState(false);
  const url =
    typeof location === "undefined"
      ? cite.path
      : `${location.origin}${cite.path}`;
  const year = cite.date.slice(0, 4);
  const text = `${cite.author} (${year}). ${cite.title}. ${cite.kind}, Unstuck. ${url}${cite.license ? `. ${cite.license}` : ""}`;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="chip-action">
        <Quote size={14} /> {label}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="filter-popover cite-pop"
          align="end"
          sideOffset={8}
        >
          <p className="label">Cite this {cite.kind.toLowerCase()}</p>
          <p className="cite-text">{text}</p>
          <button
            className="button button-dark"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                notice("Citation copied.");
                setOpen(false);
              } catch {
                notice("Select the citation to copy it.");
              }
            }}
          >
            Copy citation
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/**
 * A form that posts JSON and refreshes the page. Fields are read from named
 * inputs, so server pages can describe the form in plain markup.
 */
export function PostForm({
  endpoint,
  extra,
  children,
  submit,
  done,
  className,
  goTo,
}: {
  endpoint: string;
  extra?: Record<string, unknown>;
  children: ReactNode;
  submit: string;
  done?: string;
  className?: string;
  /** Navigate to this path (with :id replaced) after success. */
  goTo?: string;
}) {
  const router = useRouter();
  const { viewer } = useAccount();
  const { notice } = useNotebook();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const draftKey = () =>
    `unstuck:form:${location.pathname}${location.search}:${endpoint}:${submit}`;
  const [restored, setRestored] = useState(false);
  function keepDraft(form: HTMLFormElement) {
    try {
      const values: Record<string, string[]> = {};
      for (const control of Array.from(
        form.querySelectorAll<HTMLInputElement>(
          "input[type=checkbox],input[type=radio]",
        ),
      ))
        if (control.name) values[control.name] = [];
      for (const [key, value] of new FormData(form)) {
        if (
          typeof value !== "string" ||
          /password|secret|token|recovery/i.test(key)
        )
          continue;
        (values[key] ??= []).push(value);
      }
      const raw = JSON.stringify(values);
      if (raw.length < 200_000) sessionStorage.setItem(draftKey(), raw);
    } catch {
      /* The form remains usable when browser storage is unavailable. */
    }
  }
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftKey());
      if (!raw || raw.length > 200_000 || !formRef.current) return;
      const values = JSON.parse(raw) as Record<string, unknown>;
      for (const element of Array.from(formRef.current.elements)) {
        if (!(
          element instanceof HTMLInputElement ||
          element instanceof HTMLTextAreaElement ||
          element instanceof HTMLSelectElement
        ))
          continue;
        if (
          !element.name ||
          /password|secret|token|recovery/i.test(element.name)
        )
          continue;
        if (
          element instanceof HTMLInputElement &&
          ["file", "password", "hidden"].includes(element.type)
        )
          continue;
        const saved = values[element.name];
        if (!Array.isArray(saved) || !saved.every((v) => typeof v === "string"))
          continue;
        if (
          element instanceof HTMLInputElement &&
          ["checkbox", "radio"].includes(element.type)
        )
          element.checked = saved.includes(element.value);
        else element.value = saved[0] ?? "";
      }
      setRestored(true);
    } catch {
      /* Malformed drafts never prevent a new contribution. */
    }
  }, [endpoint, submit]);
  async function send(form: HTMLFormElement) {
    if (!viewer) {
      keepDraft(form);
      setError("Choose a name to post as first.");
      return;
    }
    setBusy(true);
    setError("");
    const data: Record<string, unknown> = {};
    for (const [key, value] of new FormData(form)) {
      const v = String(value);
      const row = /^(\w+)\[(\d+)\]\.(\w+)$/.exec(key);
      if (row) {
        const list = ((data[row[1]] as Record<string, string>[]) ??= []);
        (list[Number(row[2])] ??= {})[row[3]] = v;
      } else if (key.includes(".")) {
        const [a, b] = key.split(".");
        data[a] = { ...((data[a] as object) ?? {}), [b]: v };
      } else if (key in data) {
        data[key] = [...([] as unknown[]).concat(data[key]), v];
      } else data[key] = v;
    }
    for (const box of form.querySelectorAll<HTMLInputElement>(
      "input[type=checkbox][data-bool]",
    ))
      data[box.name] = box.checked;
    try {
      const result = await postJson<{ id?: string }>(endpoint, {
        ...data,
        ...extra,
      });
      try {
        sessionStorage.removeItem(draftKey());
      } catch {
        /* Optional device storage. */
      }
      setRestored(false);
      form.reset();
      if (done) notice(done);
      if (goTo && result.id) router.push(goTo.replace(":id", result.id));
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn’t work.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      ref={formRef}
      className={className ?? "post-form"}
      onInput={(e) => keepDraft(e.currentTarget)}
      onSubmit={(e) => {
        e.preventDefault();
        send(e.currentTarget);
      }}
    >
      {children}
      {restored && (
        <p className="quiet-line" role="status">
          Your draft has been restored.
        </p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}{" "}
          {!viewer && (
            <a
              className="text-link"
              href="/account"
              onClick={(event) => {
                event.preventDefault();
                router.push(signInHref());
              }}
            >
              Choose a name
            </a>
          )}
        </p>
      )}
      <div className="post-form-actions">
        <button className="button button-dark" disabled={busy}>
          {busy ? "Saving…" : submit}
        </button>
      </div>
    </form>
  );
}
