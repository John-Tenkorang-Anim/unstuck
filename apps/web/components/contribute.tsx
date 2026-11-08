"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  FlaskConical,
  HelpCircle,
  Lightbulb,
  Link2,
  NotebookPen,
  Plus,
  Trash2,
} from "lucide-react";
import { getFile, removeFile } from "@/lib/local-media";
import { lessonLabel, type LessonKind } from "@/lib/types";
import type { Community } from "@/lib/communities";
import { MediaAttach, type Attached } from "./media-attach";
import { useNotebook } from "./notebook-provider";
import { postJson, useAccount } from "./use-account";

export type Choice = "attempt" | "problem" | "idea" | "test";
export interface ProblemOption {
  id: string;
  title: string;
  category: string;
  summary: string;
}
export interface ProposalOption {
  id: string;
  title: string;
  problem?: string;
}
type Row = { key: string; value: string };
type Link_ = { label: string; url: string };
export interface Draft {
  choice: Choice | "";
  stage: number;
  detailed: boolean;
  title: string;
  classification: string;
  trying: string;
  approach: string;
  happened: string;
  expected: string;
  why: string;
  conditions: string;
  context: Row[];
  category: string;
  problem: string;
  place: string;
  methods: string;
  measurements: string;
  beforeAfter: string;
  resources: string;
  circumstances: string;
  limitations: string;
  links: Link_[];
  personalAccount: boolean;
  lessons: { kind: LessonKind; text: string }[];
  change: string;
  questions: string;
  openToHelp: boolean;
  affiliation: string;
  collaborators: string;
  license: string;
  everyone: boolean;
  communities: string[];
  summary: string;
  affects: string;
  matters: string;
  constraints: string;
  unknowns: string;
  needs: string;
  checked: boolean;
}
const blank = (): Draft => ({
  choice: "",
  stage: 0,
  detailed: false,
  title: "",
  classification: "",
  trying: "",
  approach: "",
  happened: "",
  expected: "",
  why: "",
  conditions: "",
  context: [{ key: "", value: "" }],
  category: "",
  problem: "",
  place: "",
  methods: "",
  measurements: "",
  beforeAfter: "",
  resources: "",
  circumstances: "",
  limitations: "",
  links: [],
  personalAccount: false,
  lessons: [{ kind: "observation", text: "" }],
  change: "",
  questions: "",
  openToHelp: true,
  affiliation: "",
  collaborators: "",
  license: "CC BY 4.0",
  everyone: true,
  communities: [],
  summary: "",
  affects: "",
  matters: "",
  constraints: "",
  unknowns: "",
  needs: "",
  checked: false,
});
const storageKey = "unstuck:contribute:v2";
const mediaKey = "unstuck:contribute:v2:media";

const choices: {
  key: Choice;
  title: string;
  text: string;
  icon: ReactNode;
}[] = [
  {
    key: "attempt",
    title: "Something I tried",
    text: "An experience, experiment, project or approach, and what happened.",
    icon: <NotebookPen size={20} />,
  },
  {
    key: "problem",
    title: "A problem I need help with",
    text: "An unresolved challenge others might have faced or could help with.",
    icon: <HelpCircle size={20} />,
  },
  {
    key: "idea",
    title: "An idea for improvement",
    text: "A change or alternative to something that has been tried.",
    icon: <Lightbulb size={20} />,
  },
  {
    key: "test",
    title: "A test or result",
    text: "Evidence from evaluating a proposed improvement.",
    icon: <FlaskConical size={20} />,
  },
];
const outcomesList = [
  ["failed", "It didn’t work", "The attempt failed or was abandoned"],
  ["partial", "It partly worked", "Some of it worked, some didn’t"],
  ["worked", "It worked", "Under the conditions you had"],
  ["unexpected", "Something unexpected", "The result surprised you"],
  ["ongoing", "Still going", "Too early to say"],
] as const;
const licences = [
  [
    "CC BY 4.0",
    "Reuse with credit, including commercially",
    "Anyone may share and adapt it, even commercially, if they credit you.",
  ],
  [
    "CC BY-NC 4.0",
    "Reuse with credit, not commercially",
    "Others may share and adapt it with credit, but not for commercial purposes without asking you.",
  ],
  [
    "CC BY-SA 4.0",
    "Reuse with credit, share alike",
    "Adaptations must credit you and use the same licence.",
  ],
  [
    "All rights reserved",
    "Read only, ask before reuse",
    "People can read and cite it, but need your permission to reuse it.",
  ],
] as const;
const stages = ["Describe", "Evidence", "Lessons", "Rights & preview"];

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
/** Words in common, for spotting a problem that already exists. */
function overlap(a: string, b: string) {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 3),
    );
  const x = words(a);
  const y = words(b);
  let n = 0;
  for (const w of x) if (y.has(w) || y.has(w.replace(/s$/, ""))) n++;
  return n;
}

/**
 * Contribute: choose what to share, then a short, staged form. Simple mode
 * asks a few plain questions; detailed mode adds method, measurements and
 * limitations. Switching keeps everything, and the draft saves as you go.
 */
export function Contribute({
  problems,
  proposals,
  communities,
  joined,
  initial,
  serverDraft,
  database,
}: {
  problems: ProblemOption[];
  proposals: ProposalOption[];
  communities: Community[];
  joined: string[];
  initial: {
    choice?: Choice;
    problem?: string;
    repeat?: { id: string; title: string };
    title?: string;
    category?: string;
  };
  serverDraft?: { id: string; data: Partial<Draft> };
  database: boolean;
}) {
  const router = useRouter();
  const { viewer, signIn } = useAccount();
  const { notice } = useNotebook();
  const [d, setD] = useState<Draft>(() => ({
    ...blank(),
    ...(serverDraft?.data ?? {}),
  }));
  const [draftId, setDraftId] = useState(serverDraft?.id);
  const [media, setMedia] = useState<Attached[]>([]);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [who, setWho] = useState({ name: "", role: "" });
  const loaded = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  // Restore the local draft, then apply what the link asked for.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    let local: Partial<Draft> = {};
    if (!serverDraft)
      try {
        local = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
        setMedia(JSON.parse(localStorage.getItem(mediaKey) ?? "[]"));
      } catch {
        /* A fresh start. */
      }
    setD((prev) => {
      const next = { ...prev, ...local };
      if (initial.choice && initial.choice !== next.choice) {
        Object.assign(next, { choice: initial.choice, stage: 0 });
      }
      if (initial.problem) next.problem = initial.problem;
      if (initial.title && !next.title) next.title = initial.title;
      if (initial.category && !next.category) next.category = initial.category;
      if (initial.repeat && !next.trying)
        next.trying = `I repeated “${initial.repeat.title}” to see whether the same thing happened for me.`;
      return next;
    });
  }, [initial, serverDraft]);
  // Save to this device as you type.
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(d));
        setSaved(
          `Saved on this device at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        );
      } catch {
        /* Storage may be full or blocked. */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [d]);
  function updateMedia(next: Attached[]) {
    setMedia(next);
    try {
      localStorage.setItem(mediaKey, JSON.stringify(next));
    } catch {
      /* Media stays in memory. */
    }
  }
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setD((prev) => ({ ...prev, [k]: v }));
  function go(stage: number) {
    setError("");
    set("stage", stage);
    requestAnimationFrame(() => {
      heading.current?.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
  function choose(choice: Choice) {
    if (choice === "idea") {
      const target = d.problem || initial.problem;
      if (target) return router.push(`/improvements/new?problem=${target}`);
    }
    setD((prev) => ({ ...prev, choice, stage: 0 }));
    requestAnimationFrame(() => heading.current?.focus());
  }
  function reset() {
    setD(blank());
    updateMedia([]);
    setDraftId(undefined);
  }
  async function saveDraft() {
    if (!viewer)
      return notice(
        "Drafts are saved on this device. Choose a name to keep them across devices.",
      );
    try {
      const { id } = await postJson<{ id: string }>("/api/drafts", {
        id: draftId,
        kind: d.choice || "attempt",
        data: { ...d, stage: d.stage },
      });
      setDraftId(id);
      setSaved(
        `Draft saved to your account at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      );
      notice("Draft saved. Find it in My Space.");
    } catch (e) {
      notice(e instanceof Error ? e.message : "The draft couldn’t be saved.");
    }
  }

  const similar = useMemo(() => {
    const text =
      d.choice === "problem"
        ? `${d.title} ${d.summary}`
        : `${d.title} ${d.trying}`;
    if (text.trim().length < 12) return [];
    return problems
      .map((p) => ({ p, n: overlap(text, `${p.title} ${p.summary}`) }))
      .filter((x) => x.n >= 2 && x.p.id !== d.problem)
      .sort((a, b) => b.n - a.n)
      .slice(0, 3)
      .map((x) => x.p);
  }, [d.title, d.summary, d.trying, d.choice, d.problem, problems]);
  const linked = problems.find((p) => p.id === d.problem);

  // What a careful reader would miss. A checklist, not a judgement.
  const missing = [
    !d.expected && "Say what you expected, so others can see the gap",
    !d.conditions &&
      !d.context.some((r) => r.key && r.value) &&
      "Add the conditions that mattered, so others can judge whether it applies to them",
    !d.approach && "Describe the approach in a sentence or two",
    !d.lessons.some((l) => l.text.trim()) && "Write down at least one lesson",
    !d.category && "Choose a category so the right people find it",
  ].filter(Boolean) as string[];

  function validate(stage: number) {
    if (stage === 0) {
      if (d.title.trim().length < 6)
        return "Give it a title of at least six characters.";
      if (!d.classification) return "Say how it turned out.";
      if (d.trying.trim().length < 3) return "Say what you were trying to do.";
      if (d.happened.trim().length < 3) return "Say what happened.";
    }
    return "";
  }
  function next() {
    const problem = validate(d.stage);
    if (problem) return setError(problem);
    go(d.stage + 1);
  }

  async function ensureAccount() {
    if (viewer) return;
    if (who.name.trim().length < 2)
      throw new Error("Choose a name to publish under.");
    await signIn(who.name, who.role);
  }
  async function publishAttempt() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      for (let s = 0; s < 3; s++) {
        const problem = validate(s);
        if (problem) {
          go(s);
          throw new Error(problem);
        }
      }
      if (!d.checked)
        throw new Error(
          "Confirm you’ve removed confidential or personal information.",
        );
      if (media.some((m) => !m.alt.trim()))
        throw new Error("Describe each photo or video before publishing.");
      if (!d.everyone && !d.communities.length)
        throw new Error(
          "Choose where it should appear: everyone, a category, or both.",
        );
      await ensureAccount();
      const form = new FormData();
      form.set(
        "entry",
        JSON.stringify({
          ...d,
          lessons: d.lessons.filter((l) => l.text.trim()),
          links: d.links.filter((l) => l.url.trim()),
          context: d.detailed ? d.context : [],
          public: d.everyone,
          communities: d.communities,
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
          transcript: item.transcript,
          captions: item.captions,
          captionLanguage: item.captionLanguage,
          silent: item.silent,
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
        throw new Error(
          data.error ?? "It couldn’t be published. Your draft is safe.",
        );
      media.forEach((m) => removeFile(m.id));
      if (draftId)
        postJson("/api/drafts", { delete: draftId }).catch(() => undefined);
      try {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(mediaKey);
      } catch {
        /* Published either way. */
      }
      notice("Published. Thank you. It’s in My Space too.");
      router.push(`/entries/${data.id}`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "It couldn’t be published. Your draft is safe.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function publishProblem() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!d.checked)
        throw new Error(
          "Confirm you’ve removed confidential or personal information.",
        );
      await ensureAccount();
      const { id } = await postJson<{ id: string }>("/api/problems", {
        title: d.title,
        summary: d.summary,
        category: d.category,
        place: d.place,
        affects: d.affects,
        matters: d.matters,
        constraints: d.constraints,
        unknowns: d.unknowns,
        needs: d.needs,
      });
      if (draftId)
        postJson("/api/drafts", { delete: draftId }).catch(() => undefined);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* Published either way. */
      }
      notice("Your problem is live. People can now share attempts and ideas.");
      router.push(`/problems/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "It couldn’t be published.");
    } finally {
      setBusy(false);
    }
  }

  const categoriesList = (
    <datalist id="category-options">
      {communities.map((c) => (
        <option key={c.slug} value={c.name} />
      ))}
    </datalist>
  );
  const err = error && (
    <p className="field-error" role="alert">
      <CircleAlert size={14} aria-hidden="true" /> {error}
    </p>
  );
  const footer = (
    <p className="draft-status" aria-live="polite">
      {saved}
      {database && (
        <button type="button" className="text-link" onClick={saveDraft}>
          Save draft{viewer ? "" : " to an account"}
        </button>
      )}
      <button type="button" className="text-link" onClick={reset}>
        Start over
      </button>
    </p>
  );

  /* Step zero: what would you like to share? -------------------------- */
  if (!d.choice)
    return (
      <div className="frame contribute">
        <header className="form-head">
          <h1 ref={heading} tabIndex={-1}>
            What would you like to share?
          </h1>
          <p>Everyone’s experience counts. No qualifications needed.</p>
        </header>
        <div className="choice-grid">
          {choices.map((c) => (
            <button
              key={c.key}
              className="choice-card"
              onClick={() => choose(c.key)}
            >
              <span className="choice-icon" aria-hidden="true">
                {c.icon}
              </span>
              <strong>{c.title}</strong>
              <small>{c.text}</small>
              <ArrowRight size={16} className="choice-go" aria-hidden="true" />
            </button>
          ))}
        </div>
        {linked && (
          <p className="quiet-line">
            You’re contributing to{" "}
            <Link className="text-link" href={`/problems/${linked.id}`}>
              {linked.title}
            </Link>
            .
          </p>
        )}
      </div>
    );

  const back = (
    <button
      type="button"
      className="back-link"
      onClick={() => set("choice", "")}
    >
      <ArrowLeft size={14} /> Choose something else
    </button>
  );

  /* An idea: pick what it improves. ------------------------------------ */
  if (d.choice === "idea")
    return (
      <div className="frame contribute">
        {back}
        <header className="form-head">
          <h1 ref={heading} tabIndex={-1}>
            What does your idea improve?
          </h1>
          <p>
            Ideas stay linked to the problem they address, so they appear there
            with their status.
          </p>
        </header>
        <ul className="pick-list">
          {problems.map((p) => (
            <li key={p.id}>
              <Link href={`/improvements/new?problem=${p.id}`}>
                <strong>{p.title}</strong>
                <small>{p.category}</small>
              </Link>
            </li>
          ))}
        </ul>
        <p className="quiet-line">
          Not listed?{" "}
          <button className="text-link" onClick={() => choose("problem")}>
            Describe the problem first
          </button>
        </p>
      </div>
    );

  /* A test: pick the proposal it evaluates. ---------------------------- */
  if (d.choice === "test")
    return (
      <div className="frame contribute">
        {back}
        <header className="form-head">
          <h1 ref={heading} tabIndex={-1}>
            Which proposal did you test?
          </h1>
          <p>
            A test is recorded against the proposal it evaluates, so results
            stay connected.
          </p>
        </header>
        {proposals.length ? (
          <ul className="pick-list">
            {proposals.map((p) => (
              <li key={p.id}>
                <Link href={`/tests/new?improvement=${p.id}`}>
                  <strong>{p.title}</strong>
                  {p.problem && <small>{p.problem}</small>}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <h3>No open proposals yet.</h3>
            <p>
              Tested something without a proposal? Share it as something you
              tried instead.
            </p>
            <button
              className="button button-dark"
              onClick={() => choose("attempt")}
            >
              Share something I tried
            </button>
          </div>
        )}
      </div>
    );

  /* A problem I need help with. ---------------------------------------- */
  if (d.choice === "problem")
    return (
      <div className="frame contribute">
        {back}
        <header className="form-head">
          <h1 ref={heading} tabIndex={-1}>
            Describe the problem
          </h1>
          <p>
            Say what you’re trying to solve and what’s in the way. Others can
            then add attempts, evidence and ideas.
          </p>
        </header>
        <form
          className="stage-form"
          onSubmit={(e) => {
            e.preventDefault();
            publishProblem();
          }}
        >
          <label className="field">
            <span>The problem, as a question or a short statement</span>
            <input
              value={d.title}
              onChange={(e) => set("title", e.target.value)}
              required
              minLength={8}
              maxLength={160}
              placeholder="For example: How can our street keep a recycling collection going?"
            />
          </label>
          {similar.length > 0 && (
            <div className="similar" role="status">
              <strong>Is it one of these?</strong>
              <p>
                If so, add your experience there. Your attempt stays yours, and
                the problem keeps everything together.
              </p>
              <ul>
                {similar.map((p) => (
                  <li key={p.id}>
                    <Link href={`/problems/${p.id}`}>{p.title}</Link>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() =>
                        setD((x) => ({
                          ...x,
                          choice: "attempt",
                          problem: p.id,
                          stage: 0,
                        }))
                      }
                    >
                      Add my attempt there
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <label className="field">
            <span>Describe it</span>
            <small>What happens, and when? What have you already tried?</small>
            <textarea
              rows={4}
              value={d.summary}
              onChange={(e) => set("summary", e.target.value)}
              required
              minLength={10}
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Category</span>
              <input
                list="category-options"
                value={d.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="Pick one or name your own"
              />
              {categoriesList}
            </label>
            <label className="field">
              <span>Where (optional)</span>
              <input
                value={d.place}
                onChange={(e) => set("place", e.target.value)}
                placeholder="A city, region or setting"
              />
            </label>
          </div>
          <label className="field">
            <span>Who or what does it affect? (optional)</span>
            <input
              value={d.affects}
              onChange={(e) => set("affects", e.target.value)}
            />
          </label>
          <label className="field">
            <span>Why does it matter? (optional)</span>
            <input
              value={d.matters}
              onChange={(e) => set("matters", e.target.value)}
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Constraints (optional, one per line)</span>
              <textarea
                rows={3}
                value={d.constraints}
                onChange={(e) => set("constraints", e.target.value)}
                placeholder="Budget, tools, time, rules"
              />
            </label>
            <label className="field">
              <span>What would help? (optional, one per line)</span>
              <textarea
                rows={3}
                value={d.needs}
                onChange={(e) => set("needs", e.target.value)}
                placeholder="Experiences from similar places, someone to help test"
              />
            </label>
          </div>
          <label className="field">
            <span>What’s still unknown? (optional, one per line)</span>
            <textarea
              rows={2}
              value={d.unknowns}
              onChange={(e) => set("unknowns", e.target.value)}
            />
          </label>
          <Publishing
            d={d}
            set={set}
            viewer={viewer}
            who={who}
            setWho={setWho}
            problem
          />
          {err}
          <div className="stage-actions">
            <button className="button button-dark" disabled={busy || !database}>
              {busy ? "Publishing…" : "Publish problem"}
            </button>
            {!database && (
              <span className="quiet-line">Publishing needs a database.</span>
            )}
          </div>
          {footer}
        </form>
      </div>
    );

  /* Something I tried: four stages. ------------------------------------ */
  return (
    <div className="frame contribute">
      {back}
      <header className="form-head form-head-row">
        <div>
          <p className="record-kicker">Share something you tried</p>
          <h1 ref={heading} tabIndex={-1}>
            {
              [
                "Share what happened.",
                "Show what happened.",
                "What can others learn?",
                "Rights and preview",
              ][d.stage]
            }
          </h1>
        </div>
        <div className="mode" role="group" aria-label="Level of detail">
          <button
            type="button"
            aria-pressed={!d.detailed}
            onClick={() => set("detailed", false)}
          >
            Simple
          </button>
          <button
            type="button"
            aria-pressed={d.detailed}
            onClick={() => set("detailed", true)}
          >
            Detailed
          </button>
        </div>
      </header>
      <ol className="stepper" aria-label="Steps">
        {stages.map((s, n) => (
          <li
            key={s}
            data-state={
              n < d.stage ? "done" : n === d.stage ? "current" : "next"
            }
          >
            <button
              type="button"
              onClick={() =>
                n <= d.stage || !validate(0) ? go(n) : setError(validate(0))
              }
              aria-current={n === d.stage ? "step" : undefined}
            >
              <span className="step-num" aria-hidden="true">
                {n < d.stage ? <Check size={12} /> : n + 1}
              </span>
              {s}
            </button>
          </li>
        ))}
      </ol>
      {linked && (
        <p className="linked-problem">
          Part of <Link href={`/problems/${linked.id}`}>{linked.title}</Link>
          <button
            type="button"
            className="text-link"
            onClick={() => set("problem", "")}
          >
            Unlink
          </button>
        </p>
      )}

      <form
        className="stage-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (d.stage < 3) next();
          else publishAttempt();
        }}
      >
        {d.stage === 0 && (
          <>
            <label className="field">
              <span>Give your experience a title</span>
              <small>
                Be specific. Not “My project failed” but “Our school recycling
                program struggled to retain volunteers”.
              </small>
              <input
                value={d.title}
                onChange={(e) => set("title", e.target.value)}
                maxLength={160}
              />
            </label>
            <fieldset className="outcome-picker">
              <legend>How did it turn out?</legend>
              {outcomesList.map(([k, label, hint]) => (
                <label key={k}>
                  <input
                    type="radio"
                    name="classification"
                    checked={d.classification === k}
                    onChange={() => set("classification", k)}
                  />
                  <span>
                    <strong>{label}</strong>
                    <small>{hint}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="field">
              <span>What were you trying to do?</span>
              <textarea
                rows={3}
                value={d.trying}
                onChange={(e) => set("trying", e.target.value)}
              />
            </label>
            <label className="field">
              <span>What approach did you use?</span>
              <textarea
                rows={3}
                value={d.approach}
                onChange={(e) => set("approach", e.target.value)}
              />
            </label>
            <label className="field">
              <span>What happened?</span>
              <textarea
                rows={3}
                value={d.happened}
                onChange={(e) => set("happened", e.target.value)}
              />
            </label>
            <label className="field">
              <span>What did you expect instead?</span>
              <textarea
                rows={2}
                value={d.expected}
                onChange={(e) => set("expected", e.target.value)}
              />
            </label>
            <label className="field">
              <span>What may explain the difference? (optional)</span>
              <small>
                A guess is fine. It will be labelled as a possible explanation.
              </small>
              <textarea
                rows={2}
                value={d.why}
                onChange={(e) => set("why", e.target.value)}
              />
            </label>
            <label className="field">
              <span>What conditions or constraints mattered?</span>
              <textarea
                rows={2}
                value={d.conditions}
                onChange={(e) => set("conditions", e.target.value)}
                placeholder="Climate, budget, scale, equipment, time"
              />
            </label>
            {d.detailed && (
              <fieldset className="kv">
                <legend>Conditions as values, for comparison</legend>
                {d.context.map((row, n) => (
                  <div key={n} className="kv-row">
                    <input
                      aria-label={`Condition ${n + 1}`}
                      placeholder="For example: Scale"
                      value={row.key}
                      onChange={(e) =>
                        set(
                          "context",
                          d.context.map((r, i) =>
                            i === n ? { ...r, key: e.target.value } : r,
                          ),
                        )
                      }
                    />
                    <input
                      aria-label={`Value ${n + 1}`}
                      placeholder="10 L"
                      value={row.value}
                      onChange={(e) =>
                        set(
                          "context",
                          d.context.map((r, i) =>
                            i === n ? { ...r, value: e.target.value } : r,
                          ),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove condition ${n + 1}`}
                      onClick={() =>
                        set(
                          "context",
                          d.context.filter((_, i) => i !== n),
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    set("context", [...d.context, { key: "", value: "" }])
                  }
                >
                  <Plus size={13} /> Add a condition
                </button>
              </fieldset>
            )}
            <div className="field-row">
              <label className="field">
                <span>Category</span>
                <input
                  list="category-options"
                  value={d.category}
                  onChange={(e) => set("category", e.target.value)}
                  placeholder="Pick one or name your own"
                />
                {categoriesList}
              </label>
              <label className="field">
                <span>Where (optional)</span>
                <input
                  value={d.place}
                  onChange={(e) => set("place", e.target.value)}
                  placeholder="A city, region or setting"
                />
              </label>
            </div>
            {!linked && (
              <label className="field">
                <span>Which problem was this an attempt at? (optional)</span>
                <select
                  value={d.problem}
                  onChange={(e) => set("problem", e.target.value)}
                >
                  <option value="">Not linked to a problem</option>
                  {problems.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!linked && similar.length > 0 && (
              <div className="similar" role="status">
                <strong>Similar problems already on Unstuck</strong>
                <p>
                  Linking your attempt keeps it with others like it. It stays
                  yours.
                </p>
                <ul>
                  {similar.map((p) => (
                    <li key={p.id}>
                      <span>{p.title}</span>
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => set("problem", p.id)}
                      >
                        Link to this problem
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {d.stage === 1 && (
          <>
            <p className="stage-intro">
              Photos, documents, links or simple descriptions. A personal
              account is welcome: you don’t need formal data.
            </p>
            <MediaAttach
              value={media}
              onChange={updateMedia}
              label="Photos, video or a PDF"
            />
            <fieldset className="kv">
              <legend>Links</legend>
              {d.links.map((l, n) => (
                <div className="kv-row" key={n}>
                  <input
                    aria-label={`Link ${n + 1} description`}
                    placeholder="What it is"
                    value={l.label}
                    onChange={(e) =>
                      set(
                        "links",
                        d.links.map((x, i) =>
                          i === n ? { ...x, label: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label={`Link ${n + 1} address`}
                    type="url"
                    placeholder="https://"
                    value={l.url}
                    onChange={(e) =>
                      set(
                        "links",
                        d.links.map((x, i) =>
                          i === n ? { ...x, url: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove link ${n + 1}`}
                    onClick={() =>
                      set(
                        "links",
                        d.links.filter((_, i) => i !== n),
                      )
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-link"
                onClick={() =>
                  set("links", [...d.links, { label: "", url: "" }])
                }
              >
                <Link2 size={13} /> Add a link
              </button>
            </fieldset>
            <label className="check">
              <input
                type="checkbox"
                checked={d.personalAccount}
                onChange={(e) => set("personalAccount", e.target.checked)}
              />
              <span>This is my personal account. Label it that way.</span>
            </label>
            {d.detailed ? (
              <div className="detail-grid">
                {(
                  [
                    ["methods", "Methods or procedures"],
                    ["measurements", "Measurements"],
                    ["beforeAfter", "Before and after"],
                    ["resources", "Resources used"],
                    ["circumstances", "Relevant circumstances"],
                    ["limitations", "Known limitations"],
                  ] as const
                ).map(([k, label]) => (
                  <label className="field" key={k}>
                    <span>{label}</span>
                    <textarea
                      rows={3}
                      value={d[k]}
                      onChange={(e) => set(k, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            ) : (
              <p className="quiet-line">
                Have methods, measurements or limitations to add?{" "}
                <button
                  type="button"
                  className="text-link"
                  onClick={() => set("detailed", true)}
                >
                  Switch to detailed
                </button>
              </p>
            )}
          </>
        )}

        {d.stage === 2 && (
          <>
            <fieldset className="lesson-editor">
              <legend>What did this experience teach you?</legend>
              <p className="quiet-line">
                Say what kind of lesson each one is. It helps readers tell what
                you saw from what you think it means.
              </p>
              {d.lessons.map((l, n) => (
                <div className="lesson-row" key={n}>
                  <select
                    aria-label={`Lesson ${n + 1} kind`}
                    value={l.kind}
                    onChange={(e) =>
                      set(
                        "lessons",
                        d.lessons.map((x, i) =>
                          i === n
                            ? { ...x, kind: e.target.value as LessonKind }
                            : x,
                        ),
                      )
                    }
                  >
                    {(Object.keys(lessonLabel) as LessonKind[]).map((k) => (
                      <option key={k} value={k}>
                        {lessonLabel[k]}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`Lesson ${n + 1}`}
                    value={l.text}
                    placeholder={
                      l.kind === "observation"
                        ? "What you saw happen"
                        : l.kind === "interpretation"
                          ? "What you think explains it"
                          : "What you’d advise someone else"
                    }
                    onChange={(e) =>
                      set(
                        "lessons",
                        d.lessons.map((x, i) =>
                          i === n ? { ...x, text: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  {d.lessons.length > 1 && (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove lesson ${n + 1}`}
                      onClick={() =>
                        set(
                          "lessons",
                          d.lessons.filter((_, i) => i !== n),
                        )
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {d.lessons.length < 8 && (
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    set("lessons", [
                      ...d.lessons,
                      { kind: "recommendation", text: "" },
                    ])
                  }
                >
                  <Plus size={13} /> Add a lesson
                </button>
              )}
            </fieldset>
            <label className="field">
              <span>What would you change if you tried again?</span>
              <textarea
                rows={3}
                value={d.change}
                onChange={(e) => set("change", e.target.value)}
              />
            </label>
            <label className="field">
              <span>What questions are still unanswered?</span>
              <small>One per line.</small>
              <textarea
                rows={3}
                value={d.questions}
                onChange={(e) => set("questions", e.target.value)}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={d.openToHelp}
                onChange={(e) => set("openToHelp", e.target.checked)}
              />
              <span>
                I’m open to suggestions and collaboration. Would you like the
                community to help improve this?
              </span>
            </label>
          </>
        )}

        {d.stage === 3 && (
          <>
            {missing.length > 0 && (
              <aside className="checklist" aria-label="Before you publish">
                <strong>Worth adding before you publish</strong>
                <ul>
                  {missing.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
                <small>
                  A checklist from what’s blank, not a judgement. Nothing here
                  is required.
                </small>
              </aside>
            )}
            <Publishing
              d={d}
              set={set}
              viewer={viewer}
              who={who}
              setWho={setWho}
              communities={communities}
              joined={joined}
            />
            <section className="preview-card" aria-label="Preview">
              <span className="label">Preview</span>
              <h2>{d.title || "Untitled"}</h2>
              <p className="record-meta">
                {d.category || "General"} ·{" "}
                {outcomesList.find(([k]) => k === d.classification)?.[1] ??
                  "Outcome not set"}{" "}
                · by {viewer?.name ?? (who.name || "you")}
                {d.affiliation && `, ${d.affiliation}`}
              </p>
              {(
                [
                  ["What were we trying to achieve?", d.trying],
                  ["What did we try?", d.approach],
                  ["What happened?", d.happened],
                  ["What did we expect?", d.expected],
                  ["What may explain the difference?", d.why],
                  ["What would we do differently?", d.change],
                ] as const
              )
                .filter(([, b]) => b.trim())
                .map(([t, b]) => (
                  <div key={t} className="preview-section">
                    <h3>{t}</h3>
                    <p>{b}</p>
                  </div>
                ))}
              {d.lessons.some((l) => l.text.trim()) && (
                <div className="preview-section">
                  <h3>Lessons</h3>
                  <ul className="dash-list">
                    {d.lessons
                      .filter((l) => l.text.trim())
                      .map((l, i) => (
                        <li key={i}>
                          <b>{lessonLabel[l.kind]}:</b> {l.text}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
              <p className="record-meta">
                {media.length}{" "}
                {media.length === 1 ? "attachment" : "attachments"} ·{" "}
                {d.links.filter((l) => l.url).length} links · {d.license}
              </p>
            </section>
            <p className="publish-note">
              <b>When you publish,</b> the title, story, lessons, photos and
              links become visible to{" "}
              {d.everyone
                ? "everyone, including people without an account"
                : "anyone who opens the categories you chose"}
              . Your name{d.affiliation ? " and affiliation are" : " is"} shown
              as the author. Drafts stay private.
            </p>
          </>
        )}

        {err}
        <div className="stage-actions">
          {d.stage > 0 && (
            <button
              type="button"
              className="button button-outline"
              onClick={() => go(d.stage - 1)}
            >
              <ArrowLeft size={15} /> Back
            </button>
          )}
          {d.stage < 3 ? (
            <button className="button button-dark">
              Continue to {stages[d.stage + 1].toLowerCase()}{" "}
              <ArrowRight size={15} />
            </button>
          ) : (
            <button className="button button-dark" disabled={busy || !database}>
              {busy ? "Publishing…" : "Publish"}
            </button>
          )}
          {!database && d.stage === 3 && (
            <span className="quiet-line">Publishing needs a database.</span>
          )}
        </div>
        {footer}
      </form>
    </div>
  );
}

/** Credit, visibility, reuse licence and the confidentiality check. */
function Publishing({
  d,
  set,
  viewer,
  who,
  setWho,
  communities = [],
  joined = [],
  problem = false,
}: {
  d: Draft;
  set: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
  viewer: { name: string } | null | undefined;
  who: { name: string; role: string };
  setWho: (w: { name: string; role: string }) => void;
  communities?: Community[];
  joined?: string[];
  problem?: boolean;
}) {
  const ordered = [
    ...joined
      .map((s) => communities.find((c) => c.slug === s))
      .filter((c): c is Community => !!c),
    ...communities.filter((c) => !joined.includes(c.slug)),
  ].slice(0, 12);
  return (
    <div className="rights">
      <fieldset>
        <legend>Credit</legend>
        {viewer ? (
          <p className="quiet-line">
            Published as <b>{viewer.name}</b>.
          </p>
        ) : (
          <div className="field-row">
            <label className="field">
              <span>Name to publish under</span>
              <input
                value={who.name}
                onChange={(e) => setWho({ ...who, name: e.target.value })}
                autoComplete="nickname"
              />
            </label>
            <label className="field">
              <span>Role (optional)</span>
              <input
                value={who.role}
                onChange={(e) => setWho({ ...who, role: e.target.value })}
                placeholder="Farmer, student, engineer…"
              />
            </label>
          </div>
        )}
        {!problem && (
          <div className="field-row">
            <label className="field">
              <span>Affiliation (optional)</span>
              <input
                value={d.affiliation}
                onChange={(e) => set("affiliation", e.target.value)}
                placeholder="A school, lab, business or group"
              />
            </label>
            <label className="field">
              <span>Collaborators to credit (optional, one per line)</span>
              <textarea
                rows={2}
                value={d.collaborators}
                onChange={(e) => set("collaborators", e.target.value)}
              />
            </label>
          </div>
        )}
      </fieldset>
      {!problem && (
        <>
          <fieldset>
            <legend>Visibility</legend>
            <label className="check">
              <input
                type="checkbox"
                checked={d.everyone}
                onChange={(e) => set("everyone", e.target.checked)}
              />
              <span>Everyone: Discover, search and the problem page</span>
            </label>
            {ordered.length > 0 && (
              <div className="chip-checks">
                {ordered.map((c) => (
                  <label key={c.slug}>
                    <input
                      type="checkbox"
                      checked={d.communities.includes(c.slug)}
                      onChange={() =>
                        set(
                          "communities",
                          d.communities.includes(c.slug)
                            ? d.communities.filter((s) => s !== c.slug)
                            : [...d.communities, c.slug].slice(0, 5),
                        )
                      }
                    />
                    <span>{c.name}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <fieldset className="licence-picker">
            <legend>How others may reuse it</legend>
            <p className="quiet-line">
              Public doesn’t mean free for any use. Choose what you allow.
              People can always read and cite it.
            </p>
            {licences.map(([k, label, text]) => (
              <label key={k}>
                <input
                  type="radio"
                  name="license"
                  checked={d.license === k}
                  onChange={() => set("license", k)}
                />
                <span>
                  <strong>{label}</strong>
                  <small>{text}</small>
                </span>
              </label>
            ))}
          </fieldset>
        </>
      )}
      <div className="warning">
        <CircleAlert size={16} aria-hidden="true" />
        <div>
          <p>
            <b>Before you publish:</b> remove names, contact details, or
            anything confidential. If an idea might be patentable or
            commercially sensitive, publishing it can count as public
            disclosure. A timestamped record shows who contributed what, but it
            doesn’t establish legal ownership.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={d.checked}
              onChange={(e) => set("checked", e.target.checked)}
            />
            <span>I’ve removed confidential or personal information</span>
          </label>
        </div>
      </div>
    </div>
  );
}
