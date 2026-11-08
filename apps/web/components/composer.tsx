"use client";
import { MathInput } from "./math-input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getFile, removeFile } from "@/lib/local-media";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Download,
  FlaskConical,
  HelpCircle,
  Lightbulb,
  LockKeyhole,
  Save,
  ScanEye,
  Trash2,
  Wrench,
} from "lucide-react";
import type { EntryKind, Outcome } from "@/lib/types";
import { kindLabels } from "@/lib/data";
import { MediaAttach, type Attached } from "./media-attach";
import { useNotebook } from "./notebook-provider";
import { useAccount } from "./use-account";
import type { Community } from "@/lib/communities";

/** Read an image's natural size so it keeps its proportions when published. */
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

const kinds = [
  {
    kind: "experience",
    label: "An experience",
    description: "Something you tried, and how it went.",
    icon: BookOpen,
  },
  {
    kind: "problem",
    label: "An open question",
    description: "Where you’re stuck. What you’ve tried.",
    icon: HelpCircle,
  },
  {
    kind: "solution",
    label: "A way forward",
    description: "Something that helped solve a problem.",
    icon: Wrench,
  },
  {
    kind: "idea",
    label: "A little possibility",
    description: "An untested idea worth exploring.",
    icon: Lightbulb,
  },
  {
    kind: "discovery",
    label: "A discovery",
    description: "Something you noticed along the way.",
    icon: ScanEye,
  },
  {
    kind: "research",
    label: "A research note",
    description: "A study, method, or unexpected result.",
    icon: FlaskConical,
  },
] as const;
const allowedOutcomes: Record<EntryKind, Outcome[]> = {
  experience: ["worked", "failed", "mixed"],
  problem: [],
  solution: ["worked", "mixed"],
  idea: [],
  discovery: ["worked", "mixed", "ongoing"],
  research: ["worked", "failed", "mixed"],
};
const templates = [
  ["everyday", "Everyday life"],
  ["making", "Making & fixing"],
  ["farming_food", "Food & farming"],
  ["software", "Software"],
  ["research", "Research"],
  ["work_business", "Work & business"],
  ["community", "Community"],
];
type Draft = {
  kind: EntryKind;
  template: string;
  title: string;
  goal: string;
  approach: string;
  result: string;
  outcome: string;
  advice: string;
  country: string;
  method: string;
  limitations: string;
};
const blank: Draft = {
  kind: "experience",
  template: "everyday",
  title: "",
  goal: "",
  approach: "",
  result: "",
  outcome: "worked",
  advice: "",
  country: "",
  method: "",
  limitations: "",
};
const storageKey = "unstuck:draft:v1";
const mediaKey = "unstuck:draft:v1:media";
export function Composer({
  initialKind,
  initialTitle,
  relates,
  communities = [],
  joined = [],
  initialCommunity,
}: {
  initialKind?: string;
  /** A question typed into an Ask box elsewhere. */
  initialTitle?: string;
  relates?: string;
  communities?: Community[];
  joined?: string[];
  initialCommunity?: string;
}) {
  const [draft, setDraft] = useState<Draft>({
    ...blank,
    ...(kinds.some((k) => k.kind === initialKind)
      ? {
          kind: initialKind as EntryKind,
          outcome: allowedOutcomes[initialKind as EntryKind][0] ?? "",
        }
      : {}),
    ...(initialTitle ? { title: initialTitle.slice(0, 160) } : {}),
    // Asking a community starts in that community's field.
    ...((t) => (t ? { template: t[0] } : {}))(
      templates.find(
        (t) =>
          t[1] === communities.find((c) => c.slug === initialCommunity)?.topic,
      ),
    ),
  });
  // Someone who typed a question goes straight to writing it.
  const [step, setStep] = useState(initialTitle ? 1 : 0);
  const [audience, setAudience] = useState<{
    everyone: boolean;
    communities: string[];
  }>({
    everyone: true,
    communities: communities.some((c) => c.slug === initialCommunity)
      ? [initialCommunity!]
      : [],
  });
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [complete, setComplete] = useState(false);
  const [media, setMedia] = useState<Attached[]>([]);
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(mediaKey) ?? "[]",
      );
      if (Array.isArray(stored)) setMedia(stored as Attached[]);
    } catch {
      /* Media metadata is optional. */
    }
  }, []);
  function updateMedia(next: Attached[]) {
    setMedia(next);
    try {
      localStorage.setItem(mediaKey, JSON.stringify(next));
    } catch {
      /* Attachments last for this visit. */
    }
  }
  const { notice } = useNotebook();
  const router = useRouter();
  const { viewer, signIn } = useAccount();
  const [who, setWho] = useState({ name: "", role: "" });
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  /** Publish the note with its attachments, then open it. */
  async function publish() {
    if (publishing) return;
    setPublishing(true);
    setPublishError("");
    try {
      if (media.some((m) => !m.alt.trim()))
        throw new Error("Describe each photo or video before publishing.");
      if (!viewer) await signIn(who.name, who.role);
      if (!audience.everyone && !audience.communities.length)
        throw new Error(
          "Choose where this should appear: everyone, a community, or both.",
        );
      const form = new FormData();
      form.set(
        "entry",
        JSON.stringify({
          ...draft,
          public: audience.everyone,
          communities: audience.communities,
        }),
      );
      const meta = [];
      for (const [index, item] of media.entries()) {
        const blob = await getFile(item.id);
        if (!blob)
          throw new Error(
            `${item.name} is no longer on this device. Add it again.`,
          );
        const size = item.kind === "image" ? await imageSize(blob) : {};
        meta.push({
          alt: item.alt,
          pins: item.pins,
          moments: item.moments,
          duration: item.duration,
          ...size,
        });
        form.set(`file-${index}`, blob, item.name);
      }
      form.set("media", JSON.stringify(meta));
      const response = await fetch("/api/entries", {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error ?? "The note couldn’t be published.");
      media.forEach((item) => removeFile(item.id));
      try {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(mediaKey);
      } catch {
        /* The published note is safe either way. */
      }
      notice("Published. It’s in your notebook too.");
      router.push(`/entries/${data.id}`);
    } catch (failure) {
      setPublishError(
        failure instanceof Error
          ? failure.message
          : "The note couldn’t be published.",
      );
      setPublishing(false);
    }
  }
  useEffect(() => {
    if (initialTitle) {
      setSavedAt("A new question. Saving it replaces your earlier draft.");
      setLoaded(true);
      return;
    }
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(storageKey) ?? "null",
      );
      if (stored && typeof stored === "object") {
        const candidate = stored as Record<string, unknown>;
        if (
          kinds.some((k) => k.kind === candidate.kind) &&
          templates.some((t) => t[0] === candidate.template) &&
          Object.keys(blank).every((key) => typeof candidate[key] === "string")
        ) {
          const next = Object.fromEntries(
            Object.keys(blank).map((key) => [key, candidate[key]]),
          ) as Draft;
          setDraft(next);
          setSavedAt("Your previous draft is here.");
        }
      }
    } catch {
      /* A new note remains available if storage cannot be read. */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded || (!draft.title && !draft.goal && !draft.approach)) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(draft));
        setSavedAt("Saved privately on this device");
      } catch {
        setSavedAt("Storage unavailable — export your draft to keep it.");
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, loaded]);
  function update(key: keyof Draft, value: string) {
    setDraft((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "kind"
        ? { outcome: allowedOutcomes[value as EntryKind][0] ?? "" }
        : {}),
    }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }
  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
      setSavedAt("Saved privately on this device");
      notice("Your words are safe here, on this device.");
      return true;
    } catch {
      notice(
        "Browser storage is unavailable. Export your draft to keep a copy.",
      );
      return false;
    }
  }
  function next() {
    if (step === 1) {
      const nextErrors: Record<string, string> = {};
      if (draft.title.trim().length < 6)
        nextErrors.title = "Give your note a title of at least 6 characters.";
      if (!draft.goal.trim())
        nextErrors.goal = "A little context helps. What were you trying to do?";
      if (
        ["experience", "problem", "solution", "idea"].includes(draft.kind) &&
        !draft.approach.trim()
      )
        nextErrors.approach =
          "Tell us a little about what you tried or have in mind.";
      if (
        ["experience", "solution", "discovery"].includes(draft.kind) &&
        !draft.result.trim()
      )
        nextErrors.result =
          "What happened? An unfinished result is useful too.";
      if (draft.kind === "research" && !draft.method.trim())
        nextErrors.method =
          "Describe the method so someone else can understand the test.";
      if (draft.country && !/^[A-Z]{2}$/.test(draft.country))
        nextErrors.country =
          "Use a two-letter country code, for example GH or KE.";
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length) {
        requestAnimationFrame(() =>
          document.getElementById(Object.keys(nextErrors)[0])?.focus(),
        );
        return;
      }
    }
    setStep((value) => Math.min(2, value + 1));
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }
  function exportDraft() {
    const payload = {
      kind: draft.kind,
      template: draft.kind === "research" ? "research" : draft.template,
      title: draft.title.trim(),
      goal: draft.goal,
      approach: draft.approach || null,
      result: draft.result || null,
      outcome: allowedOutcomes[draft.kind].includes(draft.outcome as Outcome)
        ? draft.outcome
        : null,
      advice: draft.advice || null,
      lang: "en",
      license: "CC-BY-4.0",
      topics: [],
      context: draft.country ? { country: draft.country } : {},
      media: media.map(({ kind, name, type, size, alt, pins, moments }) => ({
        kind,
        name,
        type,
        size,
        alt,
        pins,
        moments,
      })),
      type_fields:
        draft.kind === "research"
          ? { method: draft.method, limitations: draft.limitations }
          : {},
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "unstuck-field-note.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  function discard() {
    if (
      !window.confirm(
        "Clear the draft saved on this device? This cannot be undone.",
      )
    )
      return;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* Clear current state regardless. */
    }
    setDraft(blank);
    setSavedAt("");
    setStep(0);
    setComplete(false);
    setErrors({});
  }
  const field = (
    key: keyof Draft,
    label: string,
    placeholder: string,
    multiline = true,
    optional = false,
  ) => (
    <div className="form-field">
      <label htmlFor={key}>
        {label}
        {optional && <span>optional</span>}
      </label>
      {multiline ? (
        <MathInput
          id={key}
          value={draft[key]}
          maxLength={10000}
          placeholder={placeholder}
          rows={4}
          onValue={(value) => update(key, value)}
          aria-invalid={!!errors[key]}
          aria-describedby={errors[key] ? `${key}-error` : undefined}
        />
      ) : (
        <input
          id={key}
          value={draft[key]}
          maxLength={key === "title" ? 160 : 2}
          placeholder={placeholder}
          onChange={(e) =>
            update(
              key,
              key === "country" ? e.target.value.toUpperCase() : e.target.value,
            )
          }
          aria-invalid={!!errors[key]}
          aria-describedby={errors[key] ? `${key}-error` : undefined}
        />
      )}
      {errors[key] && (
        <p className="field-error" id={`${key}-error`}>
          {errors[key]}
        </p>
      )}
      {key === "title" && (
        <small className="field-counter">{draft.title.length} / 160</small>
      )}
    </div>
  );
  const needsResult = !["problem", "idea"].includes(draft.kind);
  const checks = [
    { label: "A specific title", done: draft.title.trim().length >= 6 },
    { label: "The goal", done: !!draft.goal.trim() },
    { label: "The attempt", done: !!draft.approach.trim() },
    ...(needsResult
      ? [{ label: "The result", done: !!draft.result.trim() }]
      : []),
    ...(draft.kind === "research"
      ? [{ label: "The method", done: !!draft.method.trim() }]
      : []),
    { label: "Where it happened", done: !!draft.country },
    { label: "Advice for the next person", done: !!draft.advice.trim() },
  ];
  const doneCount = checks.filter((check) => check.done).length;
  if (complete)
    return (
      <div className="composer-success frame">
        <p className="label">Saved privately</p>
        <h1>Ready for its next chapter.</h1>
        <p className="page-lede">
          Your field note is saved privately on this device. You can return to
          edit it or export a copy. It has not been published.
        </p>
        <div className="success-note">
          <span className="label">{kindLabels[draft.kind]}</span>
          <h2>{draft.title}</h2>
          <p>{draft.goal}</p>
        </div>
        <div className="success-actions">
          <button className="button button-dark" onClick={exportDraft}>
            <Download size={15} /> Export your field note
          </button>
          <button
            className="button button-outline"
            onClick={() => setComplete(false)}
          >
            Keep editing
          </button>
          <Link href="/discover" className="text-link">
            Back to all entries <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>
    );
  return (
    <div className="composer frame">
      <header className="composer-head">
        {initialCommunity &&
        communities.some((c) => c.slug === initialCommunity) ? (
          <Link href={`/communities/${initialCommunity}`} className="back-link">
            <ArrowLeft size={14} />{" "}
            {communities.find((c) => c.slug === initialCommunity)!.name}
          </Link>
        ) : (
          <Link href="/discover" className="back-link">
            <ArrowLeft size={14} /> Discover
          </Link>
        )}
        {step === 0 ? (
          <h1>
            Ask or share. <span className="tint-brand">Either helps.</span>
          </h1>
        ) : draft.kind === "problem" ? (
          <>
            <h1>
              Ask it plainly.{" "}
              <span className="tint-brand">Someone has been there.</span>
            </h1>
            <p className="page-lede">
              Say where you’re stuck and what you’ve already tried. That’s what
              people need to help.
            </p>
          </>
        ) : (
          <>
            <h1>
              Your experience.{" "}
              <span className="tint-brand">Someone’s next step.</span>
            </h1>
            <p className="page-lede">
              It doesn’t have to be extraordinary. Just honest, specific, and
              yours.
            </p>
          </>
        )}
      </header>
      <ol className="composer-steps" aria-label="Field note progress">
        {["Choose", "Write", "Review"].map((label, i) => (
          <li
            key={label}
            className={
              step === i ? "step-current" : step > i ? "step-done" : ""
            }
            aria-current={step === i ? "step" : undefined}
          >
            <span>
              {step > i ? <Check size={13} /> : String(i + 1).padStart(2, "0")}
            </span>
            {label}
          </li>
        ))}
      </ol>
      {relates && (
        <div className="related-note">
          <BookOpen size={15} aria-hidden="true" /> A new perspective on an
          existing entry.{" "}
          <Link href={`/entries/${encodeURIComponent(relates)}`}>
            Revisit the original <ArrowUpRight size={12} />
          </Link>
        </div>
      )}
      <div className="composer-workspace">
        <div className="composer-main">
          {step === 0 ? (
            <>
              <h2>What would you like to do?</h2>
              <div className="intent-list">
                {(
                  [
                    [
                      "problem",
                      "Ask for help",
                      "Say where you’re stuck and what you’ve tried. People who’ve been there answer.",
                      HelpCircle,
                    ],
                    [
                      "experience",
                      "Share what happened",
                      "Something you tried, and whether it worked. The next person starts further along.",
                      BookOpen,
                    ],
                  ] as const
                ).map(([kind, label, detail, Icon]) => (
                  <button
                    key={kind}
                    onClick={() => update("kind", kind)}
                    aria-pressed={draft.kind === kind}
                    className="intent-option"
                  >
                    <Icon size={20} aria-hidden="true" />
                    <strong>{label}</strong>
                    <span>{detail}</span>
                  </button>
                ))}
                <Link
                  className="intent-option intent-link"
                  href="/sessions/new"
                >
                  <ScanEye size={20} aria-hidden="true" />
                  <strong>Get feedback on your work</strong>
                  <span>
                    Share a photo, PDF, video or your working, and people pin
                    what to fix.
                  </span>
                  <ArrowRight size={16} className="intent-arrow" />
                </Link>
              </div>
              <details
                className="intent-more"
                open={!["problem", "experience"].includes(draft.kind)}
              >
                <summary>Something else</summary>
                <div className="kind-list">
                  {kinds
                    .filter((k) => !["problem", "experience"].includes(k.kind))
                    .map((item) => (
                      <button
                        key={item.kind}
                        onClick={() => update("kind", item.kind)}
                        aria-pressed={draft.kind === item.kind}
                        className="kind-option"
                      >
                        <item.icon size={18} aria-hidden="true" />
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                        <span className="kind-check" aria-hidden="true">
                          {draft.kind === item.kind && <Check size={12} />}
                        </span>
                      </button>
                    ))}
                </div>
              </details>
            </>
          ) : step === 1 ? (
            <>
              <h2>Start with what happened.</h2>
              <p className="composer-lede">
                Write like you’re telling someone who is about to try the same
                thing.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  next();
                }}
                noValidate
              >
                {field(
                  "title",
                  "Give your note a useful title",
                  "A small change that made a difference",
                  false,
                )}
                <div className="form-field">
                  <label htmlFor="template">
                    Which field does it belong in?
                  </label>
                  <select
                    id="template"
                    value={
                      draft.kind === "research" ? "research" : draft.template
                    }
                    onChange={(e) => update("template", e.target.value)}
                    disabled={draft.kind === "research"}
                  >
                    {templates.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {field(
                  "goal",
                  draft.kind === "problem"
                    ? "Where are you stuck?"
                    : "What were you trying to do?",
                  "A little background goes a long way…",
                )}
                {field(
                  "approach",
                  draft.kind === "idea"
                    ? "What is the idea?"
                    : "What did you try?",
                  "The steps, materials, or choices that mattered…",
                  true,
                  !["experience", "problem", "solution", "idea"].includes(
                    draft.kind,
                  ),
                )}
                {draft.kind === "research" && (
                  <>
                    {field(
                      "method",
                      "How did you run the test?",
                      "Enough detail for someone to understand or repeat the method…",
                    )}
                    {field(
                      "limitations",
                      "What are the limitations?",
                      "What should someone know before drawing a conclusion?",
                      true,
                      true,
                    )}
                  </>
                )}
                {!["problem", "idea"].includes(draft.kind) && (
                  <>
                    {field(
                      "result",
                      "What happened?",
                      "What changed? What didn’t? What surprised you?",
                      true,
                      draft.kind === "research",
                    )}
                    <fieldset className="outcome-options">
                      <legend>How would you describe the result?</legend>
                      {allowedOutcomes[draft.kind].map((value) => (
                        <label
                          key={value}
                          className={
                            draft.outcome === value ? "outcome-selected" : ""
                          }
                        >
                          <input
                            type="radio"
                            name="outcome"
                            value={value}
                            checked={draft.outcome === value}
                            onChange={() => update("outcome", value)}
                          />
                          <span>
                            {
                              {
                                worked: "It worked",
                                failed: "It didn’t work",
                                mixed: "A mixed result",
                                ongoing: "Still learning",
                              }[value]
                            }
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  </>
                )}
                {field(
                  "advice",
                  "What would you tell the next person?",
                  "A useful detail, a pitfall, or what you would try differently…",
                  true,
                  true,
                )}
                {field(
                  "country",
                  "Where did this happen? (country code)",
                  "GH",
                  false,
                  true,
                )}
                <div className="form-field">
                  <MediaAttach value={media} onChange={updateMedia} />
                </div>
              </form>
            </>
          ) : (
            <>
              <h2>Read it as someone who wasn’t there.</h2>
              <p className="composer-lede">What would they need to know?</p>
              <article className="draft-preview">
                <span className="draft-stamp">PRIVATE DRAFT</span>
                <span className="label">{kindLabels[draft.kind]}</span>
                <h3>{draft.title}</h3>
                {[
                  ["The goal", draft.goal],
                  ["What I tried", draft.approach],
                  ...(draft.kind === "research"
                    ? [
                        ["The method", draft.method],
                        ["Limitations", draft.limitations],
                      ]
                    : []),
                  ["What happened", draft.result],
                  ["For the next person", draft.advice],
                ]
                  .filter(([, body]) => body)
                  .map(([label, body]) => (
                    <section key={label}>
                      <h4>{label}</h4>
                      <p>{body}</p>
                    </section>
                  ))}
                {draft.country && (
                  <div className="draft-country">Context: {draft.country}</div>
                )}
                {media.length > 0 && (
                  <section>
                    <h4>Photos and video</h4>
                    <ul className="draft-media">
                      {media.map((item) => (
                        <li key={item.id}>
                          {item.kind === "video" ? "Video" : "Photo"}:{" "}
                          {item.alt || item.name}
                          {item.pins.length > 0 &&
                            ` · ${item.pins.length} pinned spots`}
                          {item.moments.length > 0 &&
                            ` · ${item.moments.length} marked moments`}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </article>
              <button className="text-link draft-export" onClick={exportDraft}>
                <Download size={14} /> Export a private copy
              </button>
              <div className="publishing-note">
                <LockKeyhole size={16} aria-hidden="true" />
                <p>
                  <strong>Your words, your choice.</strong> Save it privately on
                  this device, or publish it so everyone can learn from it.
                </p>
              </div>
              <div className="publish-panel">
                {!viewer && (
                  <div className="form-row post-as">
                    <label>
                      <span>Post as</span>
                      <input
                        value={who.name}
                        maxLength={40}
                        placeholder="Your name"
                        autoComplete="nickname"
                        onChange={(e) =>
                          setWho({ ...who, name: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Your role, optional</span>
                      <input
                        value={who.role}
                        maxLength={60}
                        placeholder="Smallholder farmer"
                        onChange={(e) =>
                          setWho({ ...who, role: e.target.value })
                        }
                      />
                    </label>
                  </div>
                )}
                {publishError && (
                  <p className="field-error" role="alert">
                    {publishError}
                  </p>
                )}
                <Audience
                  communities={communities}
                  joined={joined}
                  value={audience}
                  onChange={setAudience}
                  question={draft.kind === "problem"}
                />
                <button
                  className="button button-outline"
                  disabled={
                    publishing || (!viewer && who.name.trim().length < 2)
                  }
                  onClick={publish}
                >
                  {publishing ? "Publishing…" : "Publish to Unstuck"}
                </button>
                <span className="publish-hint">
                  {viewer ? `Posting as ${viewer.name}. ` : ""}
                  {audience.everyone
                    ? "Everyone will be able to read it."
                    : "It appears in the communities you chose. Communities are open, so anyone with the link can read it."}
                </span>
              </div>
            </>
          )}
          <div className="composer-footer">
            <button
              className="quiet-link"
              onClick={step ? () => setStep(step - 1) : save}
            >
              {step ? <ArrowLeft size={15} /> : <Save size={15} />}
              {step ? "Go back" : "Save draft"}
            </button>
            <button
              className="button button-dark"
              onClick={
                step < 2
                  ? next
                  : () => {
                      if (save()) setComplete(true);
                    }
              }
            >
              {step === 0
                ? "Continue"
                : step === 1
                  ? "Review your note"
                  : "Save finished draft"}
              {step === 2 ? <Check size={16} /> : <ArrowRight size={16} />}
            </button>
          </div>
          <div className="draft-save-status" role="status">
            <span className="status-dot" />
            {savedAt || "Your words, your pace."}
          </div>
        </div>
        {step > 0 && (
          <aside className="composer-aside">
            <div className="signal">
              <div className="signal-head">
                <span className="label">Note completeness</span>
                <span className="signal-count">
                  {doneCount}/{checks.length}
                </span>
              </div>
              <div className="signal-meter" aria-hidden="true">
                {checks.map((check) => (
                  <i
                    key={check.label}
                    className={check.done ? "is-done" : ""}
                  />
                ))}
              </div>
              <ul>
                {checks.map((check) => (
                  <li key={check.label} className={check.done ? "is-done" : ""}>
                    {check.done ? <Check size={12} /> : <i />}
                    {check.label}
                    <span className="sr-only">
                      {check.done ? ", done" : ", not yet"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="writing-tip">
              <strong>Context is a gift.</strong>
              <p>
                Place, tools, budget, timing. A small detail can make all the
                difference to someone else.
              </p>
            </div>
            <div className="writing-tip">
              <strong>Keep people private.</strong>
              <p>
                Leave out names, emails, faces, and other details someone hasn’t
                agreed to share.
              </p>
            </div>
            <div className="writing-tip">
              <strong>
                <LockKeyhole size={13} aria-hidden="true" /> Your draft stays
                here.
              </strong>
              <p>It is stored on this device. You decide what to share.</p>
            </div>
            <button className="discard-button" onClick={discard}>
              <Trash2 size={13} /> Clear this draft
            </button>
          </aside>
        )}
      </div>
    </div>
  );
}

/**
 * Where a post appears: to everyone, to communities, or both. Communities you
 * joined come first; asking both gets more varied answers.
 */
function Audience({
  communities,
  joined,
  value,
  onChange,
  question,
}: {
  communities: Community[];
  joined: string[];
  value: { everyone: boolean; communities: string[] };
  onChange: (next: { everyone: boolean; communities: string[] }) => void;
  question: boolean;
}) {
  const [filter, setFilter] = useState("");
  const ordered = [
    ...joined
      .map((slug) => communities.find((c) => c.slug === slug))
      .filter((c): c is Community => !!c),
    ...communities.filter((c) => !joined.includes(c.slug)),
  ].filter((c) =>
    `${c.name} ${c.topic}`.toLowerCase().includes(filter.toLowerCase()),
  );
  const toggle = (slug: string) =>
    onChange({
      ...value,
      communities: value.communities.includes(slug)
        ? value.communities.filter((s) => s !== slug)
        : value.communities.length >= 5
          ? value.communities
          : [...value.communities, slug],
    });
  const none = !value.everyone && !value.communities.length;
  return (
    <fieldset className="audience" aria-describedby="audience-hint">
      <legend>Where should {question ? "your question" : "it"} appear?</legend>
      <p id="audience-hint" className="audience-hint">
        {question
          ? "A community gets people who know the field. Everyone gets the widest range of answers. You can choose both."
          : "Pick communities to add it to their library, and everyone to make it searchable."}
      </p>
      <label className="audience-option">
        <input
          type="checkbox"
          checked={value.everyone}
          onChange={(e) => onChange({ ...value, everyone: e.target.checked })}
        />
        <span>
          <strong>Everyone</strong>
          <small>Discover, Questions and search</small>
        </span>
      </label>
      {communities.length > 0 && (
        <>
          {communities.length > 6 && (
            <input
              className="audience-filter"
              type="search"
              value={filter}
              placeholder="Find a community"
              aria-label="Find a community"
              onChange={(e) => setFilter(e.target.value)}
            />
          )}
          <div className="audience-list">
            {ordered.map((c) => (
              <label key={c.slug} className="audience-option">
                <input
                  type="checkbox"
                  checked={value.communities.includes(c.slug)}
                  disabled={
                    !value.communities.includes(c.slug) &&
                    value.communities.length >= 5
                  }
                  onChange={() => toggle(c.slug)}
                />
                <span>
                  <strong>{c.name}</strong>
                  <small>
                    {joined.includes(c.slug) ? "You’re a member · " : ""}
                    {c.topic}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </>
      )}
      {none && (
        <p className="field-error" role="alert">
          Choose at least one place.
        </p>
      )}
    </fieldset>
  );
}
