"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { safeReturnTo } from "@/lib/navigation";
import { useState } from "react";
import { KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { useNotebook } from "./notebook-provider";
import { postJson, showRecovery, useAccount, type Viewer } from "./use-account";

/** Create an account, sign in with a recovery code, or manage this one. */
export function AccountPanel({
  initial,
  moderationEnabled,
  returnTo,
}: {
  initial: Viewer;
  moderationEnabled: boolean;
  returnTo?: string;
}) {
  const router = useRouter();
  const { viewer, signIn, signOut, recover, refresh } = useAccount(initial);
  const { notice } = useNotebook();
  const [who, setWho] = useState({ name: "", role: "" });
  const [code, setCode] = useState("");
  const [modCode, setModCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "That didn’t work. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const problem = error && (
    <p className="field-error" role="alert">
      {error}
    </p>
  );
  if (!viewer)
    return (
      <div className="account-grid">
        <form
          className="account-card"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await signIn(who.name, who.role);
              const next = safeReturnTo(returnTo);
              if (next) router.push(next);
            });
          }}
        >
          <h2>Choose a name</h2>
          <p>
            Post sessions, notes and field notes under a name of your choice.
          </p>
          <label>
            <span>Name</span>
            <input
              value={who.name}
              maxLength={40}
              autoComplete="nickname"
              onChange={(e) => setWho({ ...who, name: e.target.value })}
            />
          </label>
          <label>
            <span>Role, optional</span>
            <input
              value={who.role}
              maxLength={60}
              placeholder="Electronics technician"
              onChange={(e) => setWho({ ...who, role: e.target.value })}
            />
          </label>
          <button
            className="button button-dark"
            disabled={busy || who.name.trim().length < 2}
          >
            Create account
          </button>
        </form>
        <form
          className="account-card"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await recover(code);
              notice("Signed in on this browser.");
              const next = safeReturnTo(returnTo);
              if (next) router.push(next);
            });
          }}
        >
          <h2>Already have an account?</h2>
          <p>Enter the recovery code you saved when you created it.</p>
          <label>
            <span>Recovery code</span>
            <input
              value={code}
              autoComplete="off"
              spellCheck={false}
              placeholder="ABCD-EFGH-JKLM-NPQR-STUV"
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button
            className="button button-dark"
            disabled={busy || code.trim().length < 8}
          >
            Sign in
          </button>
        </form>
        {problem}
      </div>
    );
  return (
    <div className="account-grid">
      <section className="account-card">
        <h2>{viewer.name}</h2>
        <p>{viewer.role || "No role set"}</p>
        {viewer.moderator && (
          <p className="account-badge">
            <ShieldCheck size={14} /> Moderator ·{" "}
            <Link className="text-link" href="/moderation">
              Open the queue
            </Link>
          </p>
        )}
        <button className="button button-outline" onClick={() => run(signOut)}>
          <LogOut size={14} /> Sign out of this browser
        </button>
      </section>
      <section className="account-card">
        <h2>Recovery code</h2>
        <p>
          Lost your code? Make a new one. The old code stops working, and
          browsers already signed in stay signed in.
        </p>
        <button
          className="button button-outline"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const { recovery } = await postJson<{ recovery: string }>(
                "/api/account/recovery",
              );
              showRecovery(recovery);
            })
          }
        >
          <KeyRound size={14} /> Make a new recovery code
        </button>
      </section>
      {moderationEnabled && !viewer.moderator && (
        <form
          className="account-card"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await postJson("/api/account/moderator", { code: modCode });
              await refresh();
              notice("You’re now a moderator.");
            });
          }}
        >
          <h2>Moderators</h2>
          <p>Enter the moderator code from the people running this site.</p>
          <label>
            <span>Moderator code</span>
            <input
              type="password"
              value={modCode}
              autoComplete="off"
              onChange={(e) => setModCode(e.target.value)}
            />
          </label>
          <button className="button button-outline" disabled={busy || !modCode}>
            Become a moderator
          </button>
        </form>
      )}
      {problem}
    </div>
  );
}
