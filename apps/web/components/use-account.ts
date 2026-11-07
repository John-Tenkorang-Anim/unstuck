"use client";
import { useCallback, useEffect, useState } from "react";

export type Viewer = {
  id: string;
  name: string;
  role: string;
  moderator?: boolean;
} | null;
/** A new recovery code, shown once in a dialog by the shell. */
export const recoveryListeners = new Set<(code: string) => void>();
export const showRecovery = (code: string) =>
  recoveryListeners.forEach((listener) => listener(code));
let known: Viewer | undefined;
const listeners = new Set<(viewer: Viewer) => void>();
function publish(viewer: Viewer) {
  known = viewer;
  listeners.forEach((listener) => listener(viewer));
}
export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data as T;
}

/** The person posting on this browser, shared across every component. */
export function useAccount(initial?: Viewer) {
  // An explicit null from the server means signed out, even if another view knew someone.
  const [viewer, setViewer] = useState<Viewer | undefined>(
    initial !== undefined ? initial : known,
  );
  useEffect(() => {
    listeners.add(setViewer);
    if (known === undefined && initial === undefined)
      fetch("/api/account")
        .then((r) => (r.ok ? r.json() : { account: null }))
        .then((data) => publish(data.account ?? null))
        .catch(() => publish(null));
    else if (initial !== undefined) known = initial;
    return () => {
      listeners.delete(setViewer);
    };
  }, [initial]);
  const signIn = useCallback(async (name: string, role: string) => {
    const { account, recovery } = await postJson<{
      account: Viewer;
      recovery?: string;
    }>("/api/account", { name, role });
    publish(account);
    if (recovery) showRecovery(recovery);
    return account;
  }, []);
  const recover = useCallback(async (code: string) => {
    const { account } = await postJson<{ account: Viewer }>(
      "/api/account/recover",
      { code },
    );
    publish(account);
    return account;
  }, []);
  const refresh = useCallback(async () => {
    const data = await fetch("/api/account").then((r) => r.json());
    publish(data.account ?? null);
  }, []);
  const signOut = useCallback(async () => {
    await fetch("/api/account", { method: "DELETE" });
    publish(null);
  }, []);
  return {
    viewer: viewer ?? null,
    ready: viewer !== undefined,
    signIn,
    signOut,
    recover,
    refresh,
  };
}
