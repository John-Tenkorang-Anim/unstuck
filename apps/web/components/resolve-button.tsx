"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { useNotebook } from "./notebook-provider";
import { postJson } from "./use-account";

/** Mark a question or concern answered, or reopen it. */
export function ResolveButton({
  improvement,
  event,
  resolved,
}: {
  improvement: string;
  event: string;
  resolved: boolean;
}) {
  const router = useRouter();
  const { notice } = useNotebook();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="chip-action"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await postJson(`/api/improvements/${improvement}`, {
            action: "resolve",
            event,
            resolved: !resolved,
          });
          router.refresh();
        } catch (e) {
          notice(e instanceof Error ? e.message : "That didn’t work.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {resolved ? <RotateCcw size={13} /> : <Check size={13} />}
      {resolved ? "Reopen" : "Mark answered"}
    </button>
  );
}
