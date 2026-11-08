"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useNotebook } from "./notebook-provider";
import { postJson, useAccount } from "./use-account";
import { signInHref } from "@/lib/navigation";

export function JoinWorkspace({ id }: { id: string }) {
  const router = useRouter();
  const { viewer } = useAccount();
  const { notice } = useNotebook();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="button button-dark"
      disabled={busy}
      onClick={async () => {
        if (!viewer) return router.push(signInHref());
        setBusy(true);
        try {
          await postJson(`/api/workspaces/${id}`, { action: "join" });
          notice("You’ve joined as a contributor.");
          router.refresh();
        } catch (e) {
          notice(e instanceof Error ? e.message : "That didn’t work.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <UserPlus size={15} /> Join workspace
    </button>
  );
}

/** Move an item to another column of its board. */
export function MoveItem({
  workspace,
  item,
  status,
  columns,
}: {
  workspace: string;
  item: string;
  status: string;
  columns: readonly (readonly [string, string])[];
}) {
  const router = useRouter();
  const { notice } = useNotebook();
  return (
    <select
      className="move-select"
      aria-label="Move to"
      defaultValue={status}
      onChange={async (e) => {
        try {
          await postJson(`/api/workspaces/${workspace}`, {
            action: "move",
            item,
            status: e.target.value,
          });
          router.refresh();
        } catch (err) {
          notice(err instanceof Error ? err.message : "That didn’t work.");
          e.target.value = status;
        }
      }}
    >
      {columns.map(([k, l]) => (
        <option key={k} value={k}>
          {l}
        </option>
      ))}
    </select>
  );
}
