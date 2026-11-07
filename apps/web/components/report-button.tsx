"use client";
import * as Popover from "@radix-ui/react-popover";
import Link from "next/link";
import { useState } from "react";
import { Flag } from "lucide-react";
import { useNotebook } from "./notebook-provider";
import { postJson, useAccount } from "./use-account";

const reasons = [
  "Spam or advertising",
  "Harassment or hate",
  "Unsafe or dangerous advice",
  "Someone’s private information",
  "Sexual content",
  "Copyright",
  "Something else",
];

/** Report something to moderators. Three reports hide it until it is reviewed. */
export function ReportButton({
  type,
  id,
}: {
  type: "session" | "note" | "entry";
  id: string;
}) {
  const { viewer } = useAccount();
  const { notice } = useNotebook();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(reasons[0]);
  const [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    try {
      const result = await postJson<{ hidden: boolean }>("/api/reports", {
        type,
        id,
        reason: detail.trim() ? `${reason}: ${detail.trim()}` : reason,
      });
      setOpen(false);
      notice(
        result.hidden
          ? "Reported. It’s hidden until a moderator reviews it."
          : "Reported. A moderator will review it.",
      );
    } catch (error) {
      notice(
        error instanceof Error ? error.message : "The report couldn’t be sent.",
      );
    } finally {
      setBusy(false);
    }
  }
  const noun = type === "entry" ? "field note" : type;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="report-button"
        aria-label={`Report this ${noun}`}
      >
        <Flag size={13} aria-hidden="true" /> Report
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="filter-popover report-menu"
          align="end"
          sideOffset={6}
        >
          {viewer ? (
            <>
              <p className="report-title">What’s wrong with this {noun}?</p>
              <div role="radiogroup" aria-label="Reason">
                {reasons.map((r) => (
                  <label key={r} className="report-reason">
                    <input
                      type="radio"
                      name={`reason-${id}`}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                    />
                    {r}
                  </label>
                ))}
              </div>
              <textarea
                rows={2}
                maxLength={200}
                aria-label="More detail, optional"
                placeholder="More detail, optional"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
              />
              <button
                className="button button-dark"
                disabled={busy}
                onClick={send}
              >
                {busy ? "Sending…" : "Send report"}
              </button>
            </>
          ) : (
            <p className="report-title">
              <Link href="/account" className="text-link">
                Choose a name
              </Link>{" "}
              to report content.
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
