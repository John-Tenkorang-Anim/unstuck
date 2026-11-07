"use client";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  Check,
  MessageCircleQuestion,
  Plus,
  Send,
  Users,
  X,
} from "lucide-react";
import {
  platformRules,
  spectralClass,
  type Community,
} from "@/lib/communities";
import { topics } from "@/lib/data";
import { postJson, useAccount } from "./use-account";
import { useNotebook } from "./notebook-provider";

/**
 * Joining is a deliberate step. The dialog shows what the community is for,
 * what members get and the rules, and asks for agreement and an optional
 * introduction. Communities are open, so nobody has to approve it.
 */
export function JoinButton({
  community,
  joined: initial,
  members: initialMembers,
  enabled = true,
  compact = false,
}: {
  community: Community;
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
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"join" | "welcome" | "leave">("join");
  const [who, setWho] = useState({ name: "", role: "" });
  const [intro, setIntro] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { slug, name } = community;
  function show() {
    setStage(joined ? "leave" : "join");
    setError("");
    setOpen(true);
  }
  async function send(join: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!viewer) await signIn(who.name.trim(), who.role.trim());
      const result = await postJson<{ joined: boolean; members: number }>(
        `/api/communities/${slug}/membership`,
        join ? { join, agree: agreed, intro } : { join },
      );
      setJoined(result.joined);
      setMembers(result.members);
      if (join) setStage("welcome");
      else {
        setOpen(false);
        notice(`You left ${name}. Your posts there stay.`);
      }
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Try again.");
    } finally {
      setBusy(false);
    }
  }
  if (!enabled) return null;
  const canJoin = agreed && (!!viewer || who.name.trim().length >= 2);
  return (
    <div className={`join ${compact ? "join-compact" : ""}`}>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <button
          className={`button ${joined ? "button-outline" : "button-dark"}`}
          aria-haspopup="dialog"
          onClick={show}
        >
          {joined ? <Check size={15} /> : <Plus size={15} />}
          {joined ? "Joined" : "Join"}
          <span className="sr-only"> {name}</span>
        </button>
        <Dialog.Portal>
          <Dialog.Overlay className="palette-overlay" />
          <Dialog.Content className="palette join-dialog">
            <div className="join-dialog-head">
              <span
                className="community-mark"
                data-class={spectralClass(slug)}
                aria-hidden="true"
              >
                {name.slice(0, 1)}
              </span>
              <div>
                <Dialog.Title>
                  {stage === "welcome"
                    ? `Welcome to ${name}`
                    : stage === "leave"
                      ? `You’re a member of ${name}`
                      : `Join ${name}`}
                </Dialog.Title>
                <Dialog.Description>
                  {stage === "welcome"
                    ? "You’re in. Here’s where to start."
                    : stage === "leave"
                      ? "Leaving takes you off its members list. Your questions and notes stay where they are."
                      : community.about}
                </Dialog.Description>
              </div>
              <Dialog.Close className="icon-button" aria-label="Close">
                <X size={17} />
              </Dialog.Close>
            </div>

            {stage === "join" && (
              <form
                className="join-dialog-body"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (canJoin) send(true);
                }}
              >
                <section aria-labelledby="join-get">
                  <h3 id="join-get">As a member</h3>
                  <ul className="join-perks">
                    <li>
                      <MessageCircleQuestion size={16} aria-hidden="true" />
                      Its questions gather for you under Questions, in My
                      communities.
                    </li>
                    <li>
                      <Send size={16} aria-hidden="true" />
                      You can post to it, or to it alone when you want answers
                      from people in the field.
                    </li>
                    <li>
                      <Users size={16} aria-hidden="true" />
                      Your name and introduction appear on its members list.
                    </li>
                  </ul>
                </section>
                <section aria-labelledby="join-rules">
                  <h3 id="join-rules">Rules</h3>
                  <ol className="join-rules">
                    {community.rules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ol>
                  <p className="join-platform">
                    And across Unstuck: {platformRules.join(" ")}
                  </p>
                </section>
                {!viewer && (
                  <div className="join-who-fields">
                    <label>
                      <span>Your name</span>
                      <input
                        required
                        minLength={2}
                        maxLength={40}
                        value={who.name}
                        autoComplete="nickname"
                        onChange={(e) =>
                          setWho({ ...who, name: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Your role, optional</span>
                      <input
                        maxLength={60}
                        value={who.role}
                        placeholder="Beekeeper, student, engineer…"
                        onChange={(e) =>
                          setWho({ ...who, role: e.target.value })
                        }
                      />
                    </label>
                  </div>
                )}
                <label className="join-intro">
                  <span>
                    Introduce yourself <small>optional</small>
                  </span>
                  <textarea
                    rows={3}
                    maxLength={280}
                    value={intro}
                    placeholder="What you work on, where, and what you’d like to learn here."
                    onChange={(e) => setIntro(e.target.value)}
                  />
                  <small>
                    {intro.length} / 280 · Everyone can read the members list.
                  </small>
                </label>
                <label className="join-agree">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  <span>I’ll follow these rules.</span>
                </label>
                {error && (
                  <p className="field-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="join-dialog-foot">
                  <span className="join-count">
                    {members.toLocaleString("en")}{" "}
                    {members === 1 ? "member" : "members"} so far
                  </span>
                  <Dialog.Close className="button button-outline" type="button">
                    Not now
                  </Dialog.Close>
                  <button
                    className="button button-dark"
                    disabled={!canJoin || busy}
                  >
                    {busy ? "Joining…" : "Join community"}
                  </button>
                </div>
              </form>
            )}

            {stage === "welcome" && (
              <nav className="join-next" aria-label="Where to start">
                <Link
                  href={`/new?kind=problem&community=${slug}`}
                  onClick={() => setOpen(false)}
                >
                  <strong>Ask {name} a question</strong>
                  <span>Post it here alone, or here and to everyone.</span>
                </Link>
                <Link
                  href={`/communities/${slug}`}
                  onClick={() => setOpen(false)}
                >
                  <strong>Answer a waiting question</strong>
                  <span>The quickest way to be useful here.</span>
                </Link>
                <Link
                  href={`/communities/${slug}?tab=library`}
                  onClick={() => setOpen(false)}
                >
                  <strong>Browse the library</strong>
                  <span>What members already tried, shelved by outcome.</span>
                </Link>
              </nav>
            )}

            {stage === "leave" && (
              <div className="join-dialog-foot">
                {error && (
                  <p className="field-error" role="alert">
                    {error}
                  </p>
                )}
                <Dialog.Close className="button button-dark">
                  Stay a member
                </Dialog.Close>
                <button
                  className="button button-outline join-leave"
                  disabled={busy}
                  onClick={() => send(false)}
                >
                  {busy ? "Leaving…" : `Leave ${name}`}
                </button>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {!compact && (
        <span className="join-count">
          {members.toLocaleString("en")} {members === 1 ? "member" : "members"}
        </span>
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
    rules: "",
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
        rules: form.rules,
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
      <label>
        <span>Rules members agree to when they join</span>
        <textarea
          required
          rows={3}
          maxLength={1000}
          value={form.rules}
          onChange={set("rules")}
          placeholder={
            "One per line, up to five.\nSay which hive type you use.\nNo selling."
          }
        />
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
