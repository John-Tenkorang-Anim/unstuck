"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "./use-account";

/**
 * A small form that posts a written statement to an endpoint, with one or
 * more buttons that each add their own fields. Used for appeals, appeal
 * decisions, incident reports and re-checks.
 */
export function ActionForm({
  endpoint,
  field,
  label,
  placeholder,
  min = 0,
  multiline = false,
  buttons,
  done,
}: {
  endpoint: string;
  field?: string;
  label?: string;
  placeholder?: string;
  min?: number;
  multiline?: boolean;
  buttons: { label: string; extra?: Record<string, string>; tone?: "danger" }[];
  done?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function send(extra: Record<string, string> = {}) {
    setBusy(true);
    setError("");
    try {
      const result = await postJson<Record<string, unknown>>(endpoint, {
        ...(field ? { [field]: value } : {}),
        ...extra,
      });
      setValue("");
      setMessage(
        done ??
          ("checked" in result
            ? `Checked ${result.checked} uploads. ${result.matched} matched.`
            : "Done."),
      );
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "That didn’t work.",
      );
    } finally {
      setBusy(false);
    }
  }
  const Input = multiline ? "textarea" : "input";
  return (
    <div className="mod-actions">
      {field && (
        <>
          <label className="sr-only" htmlFor={`${endpoint}-${field}`}>
            {label}
          </label>
          <Input
            id={`${endpoint}-${field}`}
            value={value}
            maxLength={2000}
            rows={multiline ? 3 : undefined}
            placeholder={placeholder}
            onChange={(
              e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
            ) => setValue(e.target.value)}
          />
        </>
      )}
      <div>
        {buttons.map((button) => (
          <button
            key={button.label}
            className={`button ${button.tone === "danger" ? "button-dark" : "button-outline"}`}
            disabled={busy || value.trim().length < min}
            onClick={() => send(button.extra)}
          >
            {button.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="mod-meta" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
