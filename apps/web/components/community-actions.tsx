"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Check, Plus } from "lucide-react";
import { topics } from "@/lib/data";
import { postJson, useAccount } from "./use-account";
import { useNotebook } from "./notebook-provider";

/** Join or leave an open community. Signing in takes one name. */
export function JoinButton({
  slug,
  name,
  joined: initial,
  members: initialMembers,
  enabled = true,
  compact = false,
}: {
  slug: string;
  name: string;
  joined: boolean;
  members: number;
  enabled?: boolean;
  compact?: boolean;
}) {
  const { viewer, signIn } = useAccount();
  const { notice } = useNotebook();
  const router = useRouter();
  const [joined, setJoined] = useState(initial);
  const [members, setMembers] = useState(initialMembers);
  const [asking, setAsking] = useState(false);
  const [who, setWho] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function toggle(event?: FormEvent) {
    event?.preventDefault();
    if (busy) return;
    if (!viewer && !who.trim()) {
      setAsking(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!viewer) await signIn(who.trim(), "");
      const result = await postJson<{ joined: boolean; members: number }>(
        `/api/communities/${slug}/membership`,
        { join: !joined },
      );
      setJoined(result.joined);
      setMembers(result.members);
      setAsking(false);
      notice(result.joined ? `You joined ${name}.` : `You left ${name}.`);
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }
  if (!enabled) return null;
  return (
    <div className={`join ${compact ? "join-compact" : ""}`}>
      {asking && !viewer ? (
        <form className="join-who" onSubmit={toggle}>
          <input
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder="Your name"
            aria-label="Your name"
            maxLength={40}
            minLength={2}
            autoFocus
          />
          <button className="button button-dark" disabled={busy}>
            Join
          </button>
        </form>
      ) : (
        <button
          className={`button ${joined ? "button-outline" : "button-dark"}`}
          aria-pressed={joined}
          disabled={busy}
          onClick={() => toggle()}
        >
          {joined ? <Check size={15} /> : <Plus size={15} />}
          {joined ? "Joined" : "Join"}
        </button>
      )}
      {!compact && (
        <span className="join-count">
          {members.toLocaleString("en")} {members === 1 ? "member" : "members"}
        </span>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Start an open community around a kind of problem. */
export function CreateCommunity({ enabled }: { enabled: boolean }) {
  const { viewer, signIn } = useAccount();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    about: "",
    topic: "",
    who: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!enabled)
    return (
      <p className="quiet-notice">
        Creating communities needs the shared database. Run npm run db:start and
        set DATABASE_URL.
      </p>
    );
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!viewer) await signIn(form.who.trim(), "");
      const { slug } = await postJson<{ slug: string }>("/api/communities", {
        name: form.name,
        about: form.about,
        topic: form.topic,
      });
      router.push(`/communities/${slug}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Try again.");
      setBusy(false);
    }
  }
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });
  return (
    <form className="create-community" onSubmit={submit}>
      <label>
        <span>Name</span>
        <input
          required
          minLength={3}
          maxLength={60}
          value={form.name}
          onChange={set("name")}
          placeholder="Beekeepers in the Volta Region"
        />
      </label>
      <label>
        <span>What it’s for</span>
        <textarea
          required
          minLength={10}
          maxLength={300}
          rows={3}
          value={form.about}
          onChange={set("about")}
          placeholder="The kinds of problems people bring here, in a sentence or two."
        />
      </label>
      <label>
        <span>Field</span>
        <select required value={form.topic} onChange={set("topic")}>
          <option value="" disabled>
            Choose a field
          </option>
          {topics.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      {!viewer && (
        <label>
          <span>Your name</span>
          <input
            required
            minLength={2}
            maxLength={40}
            value={form.who}
            onChange={set("who")}
            autoComplete="nickname"
          />
        </label>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="create-community-foot">
        <p>Anyone can read, join and post. You can’t make it private.</p>
        <button className="button button-dark" disabled={busy}>
          {busy ? "Creating…" : "Create community"}
        </button>
      </div>
    </form>
  );
}
