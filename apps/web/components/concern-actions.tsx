"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HandHeart } from "lucide-react";
import { concernStatus, eventLabel, type ConcernStatus } from "@/lib/concerns";
import { signInHref } from "@/lib/navigation";
import { useNotebook } from "./notebook-provider";
import { postJson, useAccount } from "./use-account";

/** “I’m affected too”: one tap adds your voice to a concern. */
export function SupportConcern({
  workspace,
  concern,
  supporters,
  supporting,
  sample,
}: {
  workspace: string;
  concern: string;
  supporters: number;
  supporting: boolean;
  sample?: boolean;
}) {
  const router = useRouter();
  const { viewer } = useAccount();
  const { notice } = useNotebook();
  const [state, setState] = useState({ supporters, supporting });
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="support-button"
      aria-pressed={state.supporting}
      disabled={busy}
      onClick={async () => {
        if (sample)
          return notice(
            "This is sample data. Join a real workspace to add your voice.",
          );
        if (!viewer) return router.push(signInHref());
        setBusy(true);
        try {
          const next = await postJson<{
            supporters: number;
            supporting: boolean;
          }>(`/api/workspaces/${workspace}/concerns/${concern}`, {
            action: "support",
            on: !state.supporting,
          });
          setState(next);
          router.refresh();
        } catch (e) {
          notice(e instanceof Error ? e.message : "That didn’t work.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <HandHeart size={17} aria-hidden="true" />
      <span>
        <strong>{state.supporters}</strong>
        {state.supporting ? "You’re affected too" : "I’m affected too"}
      </span>
    </button>
  );
}

const kinds = [
  ["note", "Add context", "What you’ve seen, when and where"],
  ["evidence", "Add evidence", "A photo, document or record, with a link"],
  ["progress", "Progress update", "What has changed since the last update"],
  ["response", "Record a response", "What an organisation or official said"],
  ["commitment", "Record a commitment", "Someone agreed to act by a date"],
  ["status", "Change status", "Editors move the concern along"],
] as const;
type Kind = (typeof kinds)[number][0];
const nextStatus: Record<ConcernStatus, ConcernStatus[]> = {
  open: ["acknowledged", "in_progress"],
  acknowledged: ["open", "in_progress", "resolved"],
  in_progress: ["open", "acknowledged", "resolved"],
  resolved: ["open"],
};

/**
 * One form for every kind of contribution, showing only the fields that kind
 * needs. Responses and commitments made by someone else must cite a source.
 */
export function ConcernForm({
  workspace,
  concern,
  status,
  version,
  canSteer,
}: {
  workspace: string;
  concern: string;
  status: ConcernStatus;
  version: number;
  canSteer: boolean;
}) {
  const router = useRouter();
  const { viewer } = useAccount();
  const { notice } = useNotebook();
  const [kind, setKind] = useState<Kind>("note");
  const [mode, setMode] = useState<"direct" | "recorded">("recorded");
  const [to, setTo] = useState<ConcernStatus>(nextStatus[status][0]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const needsSource =
    kind === "evidence" ||
    (kind === "status" && to === "resolved") ||
    ((kind === "response" || kind === "commitment") && mode === "recorded");
  async function send(form: HTMLFormElement) {
    if (!viewer) return router.push(signInHref());
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(form));
    try {
      await postJson(`/api/workspaces/${workspace}/concerns/${concern}`, {
        ...data,
        kind,
        mode,
        version,
        ...(kind === "status" ? { status: to } : {}),
      });
      form.reset();
      notice(`${eventLabel[kind]} added to the public record.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn’t work.");
    } finally {
      setBusy(false);
    }
  }
  const available = kinds.filter(([k]) => k !== "status" || canSteer);
  return (
    <form
      className="post-form concern-form"
      onSubmit={(e) => {
        e.preventDefault();
        send(e.currentTarget);
      }}
    >
      <fieldset className="kind-picker">
        <legend>What are you adding?</legend>
        {available.map(([k, label]) => (
          <label key={k}>
            <input
              type="radio"
              name="kind-choice"
              checked={kind === k}
              onChange={() => setKind(k)}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <p className="quiet-line">{kinds.find(([k]) => k === kind)?.[2]}.</p>
      {kind === "status" && (
        <label className="field">
          <span>New status</span>
          <select
            value={to}
            onChange={(e) => setTo(e.target.value as ConcernStatus)}
          >
            {nextStatus[status].map((s) => (
              <option key={s} value={s}>
                {concernStatus[s]}
              </option>
            ))}
          </select>
        </label>
      )}
      {(kind === "response" || kind === "commitment") && (
        <>
          <div className="seg" role="group" aria-label="Who is speaking">
            <button
              type="button"
              aria-pressed={mode === "recorded"}
              onClick={() => setMode("recorded")}
            >
              Recording someone else’s words
            </button>
            <button
              type="button"
              aria-pressed={mode === "direct"}
              onClick={() => setMode("direct")}
            >
              Speaking for my organisation
            </button>
          </div>
          <label className="field">
            <span>Organisation (optional)</span>
            <input
              name="organization"
              maxLength={160}
              placeholder="For example: the district assembly"
            />
          </label>
        </>
      )}
      {kind === "commitment" && (
        <div className="field-row">
          <label className="field">
            <span>Who will act</span>
            <input name="responsible" required minLength={2} />
          </label>
          <label className="field">
            <span>By when</span>
            <input name="due" type="date" required />
          </label>
        </div>
      )}
      <label className="field">
        <span>
          {kind === "commitment"
            ? "What was committed"
            : kind === "status"
              ? "Why the status changes"
              : "Details"}
        </span>
        <textarea name="body" rows={3} required minLength={10} />
      </label>
      <label className="field">
        <span>Source link{needsSource ? "" : " (optional)"}</span>
        <input
          name="source"
          required={needsSource}
          placeholder="https://… or a link to a record on Unstuck"
        />
      </label>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="post-form-actions">
        <button className="button button-dark" disabled={busy}>
          {busy ? "Adding…" : "Add to the record"}
        </button>
        <span className="quiet-line">
          Updates are kept in order and can’t be silently edited.
        </span>
      </div>
    </form>
  );
}

/** Record that a commitment was done, with proof. */
export function CompleteCommitment({
  workspace,
  concern,
  commitment,
}: {
  workspace: string;
  concern: string;
  commitment: string;
}) {
  const router = useRouter();
  const { notice } = useNotebook();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <button className="chip-action" onClick={() => setOpen(true)}>
        Record completion
      </button>
    );
  return (
    <form
      className="complete-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const data = Object.fromEntries(new FormData(e.currentTarget));
        try {
          await postJson(`/api/workspaces/${workspace}/concerns/${concern}`, {
            ...data,
            kind: "completion",
            commitment,
          });
          notice("Completion recorded.");
          router.refresh();
        } catch (err) {
          notice(err instanceof Error ? err.message : "That didn’t work.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        name="body"
        required
        minLength={10}
        aria-label="What was done"
        placeholder="What was done, and how residents can check it"
      />
      <input
        name="source"
        required
        aria-label="Proof link"
        placeholder="Proof: https://…"
      />
      <button className="button button-dark" disabled={busy}>
        Save
      </button>
    </form>
  );
}
