"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "./use-account";

type Choice = {
  action: string;
  label: string;
  type: string;
  id: string;
  tone?: "danger";
};

/** One moderator decision with its required explanation. */
export function ModerationActions({ choices }: { choices: Choice[] }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function act(choice: Choice) {
    setBusy(true);
    setError("");
    try {
      await postJson("/api/moderation", {
        action: choice.action,
        type: choice.type,
        id: choice.id,
        note,
      });
      setNote("");
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "That action failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mod-actions">
      <label className="sr-only" htmlFor={`why-${choices[0].id}`}>
        Explain your decision
      </label>
      <input
        id={`why-${choices[0].id}`}
        value={note}
        maxLength={500}
        placeholder="Explain your decision (at least 10 characters)"
        onChange={(e) => setNote(e.target.value)}
      />
      <div>
        {choices.map((choice) => (
          <button
            key={choice.action}
            className={`button ${choice.tone === "danger" ? "button-dark" : "button-outline"}`}
            disabled={busy || note.trim().length < 10}
            onClick={() => act(choice)}
          >
            {choice.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
