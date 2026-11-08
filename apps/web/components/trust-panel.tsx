"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { ShieldCheck, X } from "lucide-react";
import type { ReactNode } from "react";

/**
 * "Evidence & Attribution": what supports a record and who contributed what,
 * in a side panel opened from the evidence indicator.
 */
export function TrustPanel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="trust-trigger">
        <ShieldCheck size={15} aria-hidden="true" />
        <span>{label}</span>
        <small>Evidence & attribution</small>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay" />
        <Dialog.Content className="sheet" aria-describedby={undefined}>
          <div className="sheet-head">
            <Dialog.Title>Evidence & Attribution</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Close">
              <X size={18} />
            </Dialog.Close>
          </div>
          <div className="sheet-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
