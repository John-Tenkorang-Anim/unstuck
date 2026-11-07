"use client";
import { Check, Copy, Link as LinkIcon } from "lucide-react";
import { useState } from "react";
import { SaveButton } from "./entry-card";
import { useNotebook } from "./notebook-provider";
export function EntryActions({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const { notice } = useNotebook();
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      notice("Link copied. A good idea travels.");
    } catch {
      notice("Copy the address from your browser to share this field note.");
    }
  }
  return (
    <div className="entry-actions">
      <SaveButton id={id} />
      <button className="button button-outline" onClick={share}>
        {copied ? <Check size={15} /> : <LinkIcon size={15} />}
        {copied ? "Link copied" : "Share this note"}
      </button>
    </div>
  );
}
