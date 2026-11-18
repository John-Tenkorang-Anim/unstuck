"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, HeartHandshake, X } from "lucide-react";
import { audiences, helpKinds, type Audience, type HelpKind } from "@/lib/help";
import { useNotebook } from "./notebook-provider";

const helpDraftKey = "unstuck:help-draft";
import { postJson, useAccount } from "./use-account";

/**
 * Ask for help, problem first. The student types what they’re stuck on before
 * anything else; who they are only reorders the suggestions; signing in
 * happens on the same page, and what they typed is kept on this device.
 */
export function HelpForm({
  initial,
  problems,
  categories,
  enabled,
}: {
  initial: {
    audience?: Audience;
    kind?: HelpKind;
    problemId?: string;
    entryId?: string;
    title?: string;
    category?: string;
  };
  problems: { id: string; title: string }[];
  categories: string[];
  enabled: boolean;
}) {
  const router = useRouter();
  const { viewer, signIn } = useAccount();
  const [draft, setDraft] = useState({
    title: initial.title ?? "",
    body: "",
    audience: (initial.audience ?? "student") as Audience,
    kind: initial.kind as HelpKind | undefined,
    graded: false,
    problemId: initial.problemId ?? "",
    category: initial.category ?? "",
  });
  const [name, setName] = useState("");
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const loaded = useRef(false);
  // Keep what was typed on this device, so nothing is lost on the way.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem(helpDraftKey) ?? "{}");
      setDraft((d) => ({
        ...d,
        ...saved,
        title: initial.title || saved.title || "",
        problemId: initial.problemId || saved.problemId || "",
      }));
    } catch {
      /* A fresh start. */
    }
  }, [initial.title, initial.problemId]);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(helpDraftKey, JSON.stringify(draft));
    } catch {
      /* Storage may be blocked. */
    }
  }, [draft]);
  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  const suggested = audiences.find((a) => a.key === draft.audience)!.kinds;
  const kind = draft.kind ?? suggested[0];
  const shown = more
    ? helpKinds
    : helpKinds.filter(
        (k) => suggested.slice(0, 3).includes(k.key) || k.key === kind,
      );
  const canGrade = kind === "hints" || kind === "explain" || kind === "review";
  async function send() {
    setBusy(true);
    setError("");
    try {
      if (draft.title.trim().length < 8)
        throw new Error(
          "Say in one line what you’re stuck on (at least 8 characters).",
        );
      if (draft.body.trim().length < 20)
        throw new Error(
          "Add a little more detail: what you tried and what happened.",
        );
      if (!viewer) {
        if (name.trim().length < 2)
          throw new Error("Choose a name to post under.");
        await signIn(
          name.trim(),
          draft.audience === "student" ? "Student" : "",
        );
      }
      const { id } = await postJson<{ id: string }>("/api/help", {
        ...draft,
        kind,
        graded: canGrade && draft.graded,
        entryId: initial.entryId,
      });
      try {
        localStorage.removeItem(helpDraftKey);
      } catch {
        /* Sent either way. */
      }
      router.push(`/help/${id}`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "That didn’t work. What you typed is kept.",
      );
      setBusy(false);
    }
  }
  return (
    <form
      className="post-form long-form help-form"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label className="field field-lead">
        <span>What are you stuck on?</span>
        <input
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={180}
          placeholder="For example: My pendulum lab keeps giving g = 10.6 m/s²"
          autoFocus={!draft.title}
        />
      </label>
      <label className="field">
        <span>What have you tried so far?</span>
        <small>
          What you did, what happened, and anything you can’t change.
        </small>
        <textarea
          rows={4}
          value={draft.body}
          onChange={(e) => set("body", e.target.value)}
        />
      </label>
      <fieldset className="kind-picker help-kinds">
        <legend>
          What would help most?{" "}
          <span className="help-as">
            I’m a{" "}
            <select
              aria-label="I’m asking as a"
              value={draft.audience}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  audience: e.target.value as Audience,
                  kind: undefined,
                }))
              }
            >
              {audiences.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label.toLowerCase()}
                </option>
              ))}
            </select>
          </span>
        </legend>
        {shown.map((k) => (
          <label key={k.key} title={k.ask}>
            <input
              type="radio"
              name="kind-choice"
              checked={kind === k.key}
              onChange={() => set("kind", k.key)}
            />
            <span>{k.label}</span>
          </label>
        ))}
        {!more && (
          <button
            type="button"
            className="text-link"
            onClick={() => setMore(true)}
          >
            Something else
          </button>
        )}
      </fieldset>
      {canGrade && (
        <label className="check">
          <input
            type="checkbox"
            checked={draft.graded}
            onChange={(e) => set("graded", e.target.checked)}
          />
          <span>It’s for graded work, so I want hints, not answers.</span>
        </label>
      )}
      <details className="disclosure">
        <summary>Link it to a problem or category (optional)</summary>
        <div className="field-row">
          <label className="field">
            <span>Related problem</span>
            <select
              value={draft.problemId}
              onChange={(e) => set("problemId", e.target.value)}
            >
              <option value="">None</option>
              {problems.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Category</span>
            <input
              list="help-categories"
              value={draft.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="Pick one or name your own"
            />
            <datalist id="help-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
        </div>
      </details>
      {viewer === null && (
        <label className="field">
          <span>Your name on Unstuck</span>
          <small>
            Any name you like. No email needed. You’ll get a recovery code to
            use it on other devices.
          </small>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
            maxLength={40}
          />
        </label>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="post-form-actions">
        <button className="button button-dark" disabled={busy || !enabled}>
          {busy ? "Sending…" : "Ask for help"}
        </button>
        <span className="quiet-line">
          {enabled
            ? "It goes to people who’ve faced something similar. Replies show up in Activity."
            : "Asking is switched off on this copy of Unstuck. What you typed stays on this device."}
        </span>
      </div>
    </form>
  );
}

/** The asker’s choices on an offer: accept it, decline it, or say it helped. */
export function OfferControls({
  request,
  offer,
  status,
  helped,
}: {
  request: string;
  offer: string;
  status: "offered" | "accepted" | "declined";
  helped: boolean;
}) {
  const router = useRouter();
  const { notice } = useNotebook();
  const [busy, setBusy] = useState(false);
  async function act(action: string, done: string) {
    setBusy(true);
    try {
      await postJson(`/api/help/${request}`, { action, offer });
      notice(done);
      router.refresh();
    } catch (e) {
      notice(e instanceof Error ? e.message : "That didn’t work.");
    } finally {
      setBusy(false);
    }
  }
  if (helped) return null;
  return (
    <div className="offer-controls">
      <button
        className="button button-dark"
        disabled={busy}
        onClick={() =>
          act("helped", "Thank you. They’re credited for helping.")
        }
      >
        <HeartHandshake size={14} /> This helped
      </button>
      {status !== "accepted" && (
        <button
          className="chip-action"
          disabled={busy}
          onClick={() =>
            act("accept", "Accepted. They can see you’d like their help.")
          }
        >
          <Check size={14} /> Accept
        </button>
      )}
      {status !== "declined" && (
        <button
          className="chip-action"
          disabled={busy}
          onClick={() => act("decline", "Declined.")}
        >
          <X size={14} /> Not this time
        </button>
      )}
    </div>
  );
}

export function CloseRequest({
  request,
  open,
}: {
  request: string;
  open: boolean;
}) {
  const router = useRouter();
  const { notice } = useNotebook();
  return (
    <button
      className="chip-action"
      onClick={async () => {
        try {
          await postJson(`/api/help/${request}`, {
            action: open ? "close" : "reopen",
          });
          router.refresh();
        } catch (e) {
          notice(e instanceof Error ? e.message : "That didn’t work.");
        }
      }}
    >
      {open ? "Close request" : "Reopen request"}
    </button>
  );
}
