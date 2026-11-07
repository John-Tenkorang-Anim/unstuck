"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { Copy, KeyRound } from "lucide-react";
import { recoveryListeners } from "./use-account";

/** Shows a new recovery code once, right after it is created. */
export function RecoveryDialog() {
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const listener = (next: string) => {
      setCopied(false);
      setCode(next);
    };
    recoveryListeners.add(listener);
    return () => {
      recoveryListeners.delete(listener);
    };
  }, []);
  return (
    <Dialog.Root open={!!code} onOpenChange={(open) => !open && setCode("")}>
      <Dialog.Portal>
        <Dialog.Overlay className="palette-overlay" />
        <Dialog.Content className="palette recovery-dialog">
          <KeyRound size={22} aria-hidden="true" />
          <Dialog.Title>Save your recovery code</Dialog.Title>
          <Dialog.Description>
            This code signs you in on another device or after clearing this
            browser. It is shown only now. Keep it somewhere private.
          </Dialog.Description>
          <p className="recovery-code" aria-label="Recovery code">
            {code}
          </p>
          <div className="recovery-actions">
            <button
              className="button button-outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code);
                  setCopied(true);
                } catch {
                  /* The code stays on screen to copy by hand. */
                }
              }}
            >
              <Copy size={14} /> {copied ? "Copied" : "Copy code"}
            </button>
            <Dialog.Close className="button button-dark">
              I’ve saved it
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
