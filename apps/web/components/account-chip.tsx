"use client";
import * as Popover from "@radix-ui/react-popover";
import Link from "next/link";
import { useState } from "react";
import { useAccount } from "./use-account";

/** Who is posting from this browser, with a way to stop. */
export function AccountChip() {
  const { viewer, signOut } = useAccount();
  const [open, setOpen] = useState(false);
  if (!viewer) return null;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="account-chip"
        aria-label={`Signed in as ${viewer.name}`}
      >
        {viewer.name.slice(0, 1).toUpperCase()}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="filter-popover account-menu"
          align="end"
          sideOffset={8}
        >
          <p>
            <strong>{viewer.name}</strong>
            {viewer.role && <span>{viewer.role}</span>}
          </p>
          <Link
            className="account-link"
            href="/notebook?tab=posts"
            onClick={() => setOpen(false)}
          >
            Your posts
          </Link>
          <Link
            className="account-link"
            href="/notebook?tab=communities"
            onClick={() => setOpen(false)}
          >
            Your communities
          </Link>
          <Link
            className="account-link"
            href="/account"
            onClick={() => setOpen(false)}
          >
            Account and recovery code
          </Link>
          {viewer.moderator && (
            <Link
              className="account-link"
              href="/moderation"
              onClick={() => setOpen(false)}
            >
              Moderation queue
            </Link>
          )}
          <button
            onClick={async () => {
              await signOut();
              setOpen(false);
            }}
          >
            Sign out
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
