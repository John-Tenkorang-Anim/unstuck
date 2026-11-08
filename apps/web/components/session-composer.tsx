"use client";
import { MathInput } from "./math-input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Globe2 } from "lucide-react";
import { getFile, removeFile } from "@/lib/local-media";
import { fields } from "@/lib/taxonomy";
import type { Block } from "@/lib/sessions";
import { MediaAttach, type Attached } from "./media-attach";
import { hasWorking, WorkingEditor } from "./working-editor";
import { useNotebook } from "./notebook-provider";
import { useAccount } from "./use-account";

/** Read an image's natural size so pins and layout keep their proportions. */
function imageSize(blob: Blob) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => resolve({ width: 0, height: 0 });
    image.src = url;
  });
}

type Draft = {
  title: string;
  field: string;
  specialty: string;
  level: string;
  wentWrong: string;
  ask: string;
  media: Attached[];
  blocks: Block[];
  course: string;
  mode: "hints" | "full";
};
const blank: Draft = {
  title: "",
  field: fields[0].name,
  specialty: fields[0].specialties[0].name,
  level: "",
  wentWrong: "",
  ask: "",
  media: [],
  blocks: [],
  course: "",
  mode: "full",
};
const storageKey = "unstuck:session-draft:v1";

/** Start a critique: the work, what went wrong, and what feedback you want. */
export function SessionComposer() {
  const { notice } = useNotebook();
  const [draft, setDraft] = useState<Draft>(blank);
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (
        stored &&
        typeof stored.title === "string" &&
        Array.isArray(stored.media) &&
        (stored.blocks === undefined || Array.isArray(stored.blocks))
      )
        setDraft({ ...blank, ...stored });
    } catch {
      /* Start a fresh draft. */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      /* The draft lasts for this visit. */
    }
  }, [draft, loaded]);
  const set = (change: Partial<Draft>) =>
    setDraft((d) => ({ ...d, ...change }));
  const field = fields.find((f) => f.name === draft.field) ?? fields[0];
  const router = useRouter();
  const { viewer, signIn } = useAccount();
  const [who, setWho] = useState({ name: "", role: "" });
  const [busy, setBusy] = useState(false);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const next: Record<string, string> = {};
    if (draft.title.trim().length < 6)
      next.title = "Give the session a title of at least 6 characters.";
    if (!draft.media.length && !hasWorking(draft.blocks))
      next.media =
        "Add a photo, a video or your working so reviewers can see the problem.";
    if (draft.media.some((m) => !m.alt.trim()))
      next.media = "Describe each photo or video for people who can’t see it.";
    if (!draft.wentWrong.trim())
      next.wentWrong = "Say what went wrong, even if you’re not sure why.";
    if (!draft.ask.trim()) next.ask = "Say what kind of feedback would help.";
    if (!viewer && who.name.trim().length < 2)
      next.who = "Choose a name to post as.";
    setErrors(next);
    if (Object.keys(next).length) {
      requestAnimationFrame(() =>
        document.getElementById(`session-${Object.keys(next)[0]}`)?.focus(),
      );
      return;
    }
    setBusy(true);
    try {
      if (!viewer) await signIn(who.name, who.role);
      const media = draft.media[0];
      const blob = media ? await getFile(media.id) : undefined;
      if (media && !blob)
        throw new Error("Your file is no longer on this device. Add it again.");
      const size =
        media?.kind === "image" && blob ? await imageSize(blob) : undefined;
      const form = new FormData();
      form.set(
        "session",
        JSON.stringify({
          title: draft.title,
          field: draft.field,
          specialty: draft.specialty,
          level: draft.level,
          course: draft.course,
          mode: draft.mode,
          wentWrong: draft.wentWrong,
          ask: draft.ask,
          blocks: draft.blocks
            .filter((b) =>
              b.kind === "steps"
                ? b.steps.some((s) => s.trim())
                : b.kind === "code"
                  ? b.code.trim()
                  : b.csv.trim(),
            )
            .map((b) =>
              b.kind === "steps"
                ? { ...b, steps: b.steps.filter((s) => s.trim()) }
                : b,
            ),
          alt: media?.alt,
          pins: media?.pins.map((p) => ({
            ...p,
            label: p.label || "Pinned spot",
          })),
          moments: media?.moments.map((m) => ({
            ...m,
            label: m.label || "Marked moment",
          })),
          duration: media?.duration,
          ...size,
        }),
      );
      if (media && blob) form.set("work", blob, media.name);
      const response = await fetch("/api/sessions", {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error ?? "The session couldn’t be published.");
      draft.media.forEach((m) => removeFile(m.id));
      localStorage.removeItem(storageKey);
      notice("Session published. People can now add feedback.");
      router.push(`/sessions/${data.id}`);
    } catch (failure) {
      setErrors({
        publish:
          failure instanceof Error
            ? failure.message
            : "The session couldn’t be published.",
      });
      setBusy(false);
    }
  }
  const error = (key: string) =>
    errors[key] && (
      <p className="field-error" id={`session-${key}-error`}>
        {errors[key]}
      </p>
    );
  return (
    <div className="frame session-new">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/sessions" className="back-link">
          <ArrowLeft size={14} /> Critique
        </Link>
      </nav>
      <header className="page-bar">
        <div>
          <h1>Ask for critique</h1>
          <p>
            Paste a picture of your work, pin what went wrong, and say what
            would help.
          </p>
        </div>
      </header>
      <form className="session-form" onSubmit={save} noValidate>
        <div className="session-form-main">
          <div id="session-media" tabIndex={-1}>
            <MediaAttach
              value={draft.media}
              single
              label="A photo or video of your work"
              onChange={(media) => set({ media })}
            />
            <WorkingEditor
              value={draft.blocks}
              onChange={(blocks) => set({ blocks })}
            />
            {error("media")}
          </div>
        </div>
        <div className="session-form-side">
          <div className="form-field">
            <label htmlFor="session-title">Title</label>
            <input
              id="session-title"
              value={draft.title}
              maxLength={140}
              placeholder="My circuit only works when I press on the board"
              aria-invalid={!!errors.title}
              onChange={(e) => set({ title: e.target.value })}
            />
            {error("title")}
          </div>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="session-field">Field</label>
              <select
                id="session-field"
                value={draft.field}
                onChange={(e) => {
                  const next =
                    fields.find((f) => f.name === e.target.value) ?? fields[0];
                  set({
                    field: next.name,
                    specialty: next.specialties[0].name,
                  });
                }}
              >
                {fields.map((f) => (
                  <option key={f.slug}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="session-specialty">Specialty</label>
              <select
                id="session-specialty"
                value={draft.specialty}
                onChange={(e) => set({ specialty: e.target.value })}
              >
                {field.specialties.map((s) => (
                  <option key={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="session-level">
              Your context <span>optional</span>
            </label>
            <input
              id="session-level"
              value={draft.level}
              placeholder="Second-year mechanical engineering"
              onChange={(e) => set({ level: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label htmlFor="session-course">
              Course or project <span>optional</span>
            </label>
            <input
              id="session-course"
              value={draft.course}
              placeholder="Calculus II · Problem set 4"
              onChange={(e) => set({ course: e.target.value })}
            />
          </div>
          <fieldset className="outcome-options mode-options">
            <legend>Is this graded work?</legend>
            {(
              [
                ["hints", "Yes, hints only"],
                ["full", "No, full review"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={draft.mode === value ? "outcome-selected" : ""}
              >
                <input
                  type="radio"
                  name="session-mode"
                  value={value}
                  checked={draft.mode === value}
                  onChange={() => set({ mode: value })}
                />
                <span>{label}</span>
              </label>
            ))}
            <p className="mode-help">
              With hints only, reviewers point to the problem and ask guiding
              questions instead of posting a solution.
            </p>
          </fieldset>
          <div className="form-field">
            <label htmlFor="session-wentWrong">What went wrong?</label>
            <MathInput
              id="session-wentWrong"
              rows={3}
              value={draft.wentWrong}
              aria-invalid={!!errors.wentWrong}
              placeholder="What you expected, and what happened instead. Maths works between $ signs."
              onValue={(wentWrong) => set({ wentWrong })}
            />
            {error("wentWrong")}
          </div>
          <div className="form-field">
            <label htmlFor="session-ask">What feedback would help?</label>
            <MathInput
              id="session-ask"
              rows={3}
              value={draft.ask}
              aria-invalid={!!errors.ask}
              placeholder="Which part to fix first, or whether my approach makes sense."
              onValue={(ask) => set({ ask })}
            />
            {error("ask")}
          </div>
          {!viewer && (
            <div className="form-row post-as" id="session-who" tabIndex={-1}>
              <label>
                <span>Post as</span>
                <input
                  value={who.name}
                  maxLength={40}
                  placeholder="Your name"
                  autoComplete="nickname"
                  onChange={(e) => setWho({ ...who, name: e.target.value })}
                />
              </label>
              <label>
                <span>Your role, optional</span>
                <input
                  value={who.role}
                  maxLength={60}
                  placeholder="Second-year student"
                  onChange={(e) => setWho({ ...who, role: e.target.value })}
                />
              </label>
              {error("who")}
            </div>
          )}
          <div className="publishing-note">
            <Globe2 size={16} aria-hidden="true" />
            <p>
              Publishing makes this session and your file visible to everyone
              {viewer ? `, posted as ${viewer.name}` : ""}. Your draft is kept
              on this device until then.
            </p>
          </div>
          {error("publish")}
          <button className="button button-dark" disabled={busy}>
            {busy ? "Publishing…" : "Publish session"}
          </button>
        </div>
      </form>
    </div>
  );
}
