"use client";
import * as Popover from "@radix-ui/react-popover";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useAccount } from "./use-account";

type Item = { href: string; title: string; detail: string; at: string };

/** Replies to you and new responses on your posts. */
export function Notifications() {
  const { viewer } = useAccount();
  const path = usePathname();
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!viewer) return;
    let live = true;
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => live && setItems(data.items ?? []))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [viewer, path]);
  if (!viewer) return null;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="icon-button bell"
        aria-label={
          items.length
            ? `Notifications, ${items.length} new`
            : "Notifications, none new"
        }
      >
        <Bell size={17} />
        {items.length > 0 && (
          <span className="bell-count" aria-hidden="true">
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="filter-popover bell-menu"
          align="end"
          sideOffset={8}
        >
          <p className="bell-title">Notifications</p>
          {items.length ? (
            <ul>
              {items.map((item) => (
                <li key={item.href + item.at}>
                  <Link href={item.href} onClick={() => setOpen(false)}>
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="bell-empty">
              Nothing new. Replies and responses to your posts appear here.
            </p>
          )}
          <Link
            className="bell-all"
            href="/notebook"
            onClick={() => setOpen(false)}
          >
            Open My Space
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
