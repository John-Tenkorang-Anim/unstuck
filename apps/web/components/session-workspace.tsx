"use client";
import { MathInput } from "./math-input";
import dynamic from "next/dynamic";
import { useMemo, useState, type MouseEvent } from "react";
import {
  Check,
  CircleHelp,
  Crosshair,
  FileSearch,
  FlaskConical,
  GraduationCap,
  Lightbulb,
  MapPin,
  ThumbsUp,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  anchorKey,
  noteLabels,
  noteTypes,
  statusLabels,
  type NoteType,
  type Pin,
  type Session,
  type SessionNote,
  type SessionStatus,
} from "@/lib/sessions";
import { clock } from "@/lib/search";
import type { Clip } from "@/lib/types";
import { parseCsv } from "@/lib/csv";
import { MomentPlayer } from "./moment-player";
import { useNotebook } from "./notebook-provider";
import { Credit } from "./picture";
import { postJson, useAccount, type Viewer } from "./use-account";
import { MathText, WorkBlocks } from "./work-blocks";
import { ReportButton } from "./report-button";

const PdfViewer = dynamic(() => import("./pdf-viewer"), {
  ssr: false,
  loading: () => <p className="pdf-loading">Opening the PDF…</p>,
});
const noteIcons: Record<NoteType, LucideIcon> = {
  issue: TriangleAlert,
  suggestion: Lightbulb,
  question: CircleHelp,
  strength: ThumbsUp,
  hypothesis: FlaskConical,
  evidence: FileSearch,
};
const steps: SessionStatus[] = ["open", "in-review", "revised", "resolved"];
type Anchor = { key: string; label: string; detail: string; badge: string };
type Pending = Omit<Pin, "id"> & { page?: number };

/**
 * One feedback session: the work, the exact places under discussion, and the
 * notes about them, grouped by where they point. Notes are shared with
 * everyone who opens the session.
 */
export function SessionWorkspace({
  session,
  clip: inheritedClip,
  start,
  initialNotes = [],
  viewer: initialViewer,
  isOwner = false,
}: {
  session: Session;
  clip?: Clip;
  start?: number;
  initialNotes?: SessionNote[];
  viewer?: Viewer;
  isOwner?: boolean;
}) {
  const { notice } = useNotebook();
  const { viewer, signIn } = useAccount(initialViewer);
  const clip = session.clip ?? inheritedClip;
  const [shared, setShared] = useState<SessionNote[]>(initialNotes);
  const [addedPins, setAddedPins] = useState<Pin[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [status, setStatus] = useState(session.status);
  const [focus, setFocus] = useState<string | null>(null);
  const [filter, setFilter] = useState<NoteType | "all">("all");
  const [placing, setPlacing] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [who, setWho] = useState({ name: "", role: "" });
  const [draft, setDraft] = useState({
    type: noteTypes[session.kind][0],
    anchor: "whole",
    body: "",
  });
  const pins = useMemo(
    () => [...session.pins, ...addedPins],
    [session.pins, addedPins],
  );
  const round = session.rounds.at(-1)!;
  const notes = useMemo(
    () => [...session.rounds.flatMap((r) => r.notes), ...shared],
    [session.rounds, shared],
  );
  const pages = useMemo(
    () =>
      [
        ...new Set([
          ...Array.from({ length: pageCount }, (_, i) => i + 1),
          ...notes.filter((n) => n.page).map((n) => n.page!),
        ]),
      ].sort((a, b) => a - b),
    [pageCount, notes],
  );
  // Every addressable place in the work, in reading order.
  const anchors = useMemo(() => {
    const list: Anchor[] = pins.map((pin, i) => ({
      key: `pin:${pin.id}`,
      label: pin.page ? `${pin.label} (page ${pin.page})` : pin.label,
      detail: "",
      badge: String(i + 1),
    }));
    if (session.pdf)
      pages.forEach((page) =>
        list.push({
          key: `page:${page}`,
          label: `Page ${page}`,
          detail: "",
          badge: `P${page}`,
        }),
      );
    for (const block of session.blocks ?? []) {
      if (block.kind === "steps")
        block.steps.forEach((step, i) =>
          list.push({
            key: `step:${i + 1}`,
            label: `Step ${i + 1}`,
            detail: step,
            badge: `S${i + 1}`,
          }),
        );
      if (block.kind === "code")
        block.code.split("\n").forEach((line, i) => {
          if (line.trim())
            list.push({
              key: `line:${i + 1}`,
              label: `Line ${i + 1}`,
              detail: line.trim(),
              badge: `L${i + 1}`,
            });
        });
      if (block.kind === "data")
        parseCsv(block.csv).rows.forEach((row, i) =>
          list.push({
            key: `row:${i + 1}`,
            label: `Row ${i + 1}`,
            detail: row.join(" · "),
            badge: `R${i + 1}`,
          }),
        );
    }
    for (const at of [
      ...new Set(notes.filter((n) => n.at !== undefined).map((n) => n.at!)),
    ].sort((a, b) => a - b))
      list.push({
        key: `t:${at}`,
        label:
          clip?.moments.find((m) => Math.abs(m.at - at) < 1)?.label ??
          `At ${clock(at)}`,
        detail: "",
        badge: clock(at),
      });
    return list;
  }, [pins, pages, session.pdf, session.blocks, notes, clip]);
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const note of notes)
      map[anchorKey(note)] = (map[anchorKey(note)] ?? 0) + 1;
    return map;
  }, [notes]);
  const shown = notes.filter(
    (note) =>
      (filter === "all" || note.type === filter) &&
      (!focus || anchorKey(note) === focus),
  );
  const groups = [
    ...anchors,
    { key: "whole", label: "On the piece as a whole", detail: "", badge: "" },
  ]
    .map((anchor) => ({
      ...anchor,
      notes: shown.filter((n) => anchorKey(n) === anchor.key),
    }))
    .filter((group) => group.notes.length);
  const focused = anchors.find((a) => a.key === focus);
  function choose(anchor: string) {
    const next = focus === anchor ? null : anchor;
    setFocus(next);
    setPending(null);
    setDraft((d) => ({ ...d, anchor: next ?? "whole" }));
  }
  function placeAt(x: number, y: number, page?: number) {
    setPending({ x, y, label: "New pin", ...(page ? { page } : {}) });
    setPlacing(false);
    setDraft((d) => ({ ...d, anchor: "pending" }));
    document.getElementById("note-body")?.focus();
  }
  function place(event: MouseEvent<HTMLDivElement>) {
    if (!placing) return;
    const box = event.currentTarget.getBoundingClientRect();
    placeAt(
      Math.min(0.98, Math.max(0.02, (event.clientX - box.left) / box.width)),
      Math.min(0.98, Math.max(0.02, (event.clientY - box.top) / box.height)),
    );
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (draft.body.trim().length < 3 || busy) return;
    setBusy(true);
    setError("");
    try {
      if (!viewer) await signIn(who.name, who.role);
      const result = await postJson<{ note: SessionNote; pin?: Pin }>(
        `/api/sessions/${session.id}/notes`,
        {
          type: draft.type,
          body: draft.body.trim(),
          anchor: draft.anchor,
          ...(draft.anchor === "pending" && pending
            ? { pin: { ...pending, label: draft.body.trim().slice(0, 60) } }
            : {}),
        },
      );
      if (result.pin) setAddedPins((p) => [...p, result.pin!]);
      setShared((s) => [...s, result.note]);
      setPending(null);
      setDraft({
        ...draft,
        body: "",
        anchor: draft.anchor === "pending" ? "whole" : draft.anchor,
      });
      notice("Note posted to the session.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Your note couldn’t be posted.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function resolve(note: SessionNote) {
    try {
      await postJson(`/api/notes/${note.id}/resolve`);
      setShared((s) =>
        s.map((n) => (n.id === note.id ? { ...n, resolved: true } : n)),
      );
    } catch (failure) {
      notice(
        failure instanceof Error
          ? failure.message
          : "That note couldn’t be resolved.",
      );
    }
  }
  async function move(next: SessionStatus) {
    try {
      await postJson(`/api/sessions/${session.id}/status`, { status: next });
      setStatus(next);
      notice(`Session marked ${statusLabels[next].toLowerCase()}.`);
    } catch (failure) {
      notice(
        failure instanceof Error
          ? failure.message
          : "The status couldn’t be changed.",
      );
    }
  }
  const typeCounts = Object.fromEntries(
    noteTypes[session.kind].map((type) => [
      type,
      notes.filter((n) => n.type === type).length,
    ]),
  );
  const canResolve = (note: SessionNote) =>
    !!viewer && !!note.by && (note.by === viewer.id || isOwner);
  const pinTools = (
    <span className="canvas-tools">
      <button
        className={`button button-outline ${placing ? "is-active" : ""}`}
        onClick={() => setPlacing(!placing)}
        aria-pressed={placing}
      >
        <Crosshair size={14} />
        {placing ? "Click the spot on the work" : "Add a pin"}
      </button>
      {pending && (
        <span className="pending-note">
          New pin placed. Write your note to post it.
        </span>
      )}
    </span>
  );
  return (
    <div className="session">
      <header className="session-head">
        <div>
          <p className="session-meta">
            {session.kind === "critique" ? "Critique" : "Inquiry"} ·{" "}
            {session.field} · {session.specialty}
            {session.level ? ` · ${session.level}` : ""}
            {session.author ? ` · opened by ${session.author}` : ""}
          </p>
          <h1>{session.title}</h1>
          {session.course && <p className="session-course">{session.course}</p>}
          {session.author && !isOwner && (
            <ReportButton type="session" id={session.id} />
          )}
        </div>
        <ol className="session-steps" aria-label="Session status">
          {steps.map((step) => (
            <li
              key={step}
              aria-current={step === status ? "step" : undefined}
              className={
                steps.indexOf(step) < steps.indexOf(status) ? "is-done" : ""
              }
            >
              {isOwner && step !== status ? (
                <button
                  onClick={() => move(step)}
                  aria-label={`Mark as ${statusLabels[step].toLowerCase()}`}
                >
                  {statusLabels[step]}
                </button>
              ) : (
                statusLabels[step]
              )}
            </li>
          ))}
        </ol>
      </header>
      {session.mode === "hints" && (
        <p className="hints-banner">
          <GraduationCap size={18} aria-hidden="true" />
          <span>
            <strong>Graded work: hints only.</strong> Point to where it goes
            wrong and ask questions that lead there. Don’t post a full solution.
          </span>
        </p>
      )}
      {session.mediaState && session.mediaState !== "ready" && (
        <p className="review-notice" role="status">
          {session.mediaState === "pending"
            ? "Your file is waiting for a moderator. Everyone else will see it once it’s approved."
            : session.mediaState === "rejected"
              ? "A moderator removed this session’s file."
              : "This session’s file is waiting for review."}
        </p>
      )}
      <div className="session-brief">
        <p>
          <strong className="tint-brand">What went wrong</strong>{" "}
          <MathText text={session.wentWrong} />
        </p>
        <p>
          <strong className="tint-brand">What they’re asking</strong>{" "}
          <MathText text={session.ask} />
        </p>
      </div>
      <div className="session-grid">
        <div className="session-work">
          {session.work && (
            <figure className="canvas">
              <div
                className={`canvas-frame ${placing ? "is-placing" : ""}`}
                onClick={place}
              >
                <img
                  src={session.work.src}
                  width={session.work.width}
                  height={session.work.height}
                  alt={session.work.alt}
                />
                {pins.map((pin, index) => (
                  <button
                    key={pin.id}
                    id={`pin-${pin.id}`}
                    className={`pin ${focus === `pin:${pin.id}` ? "is-focus" : ""}`}
                    style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                    aria-pressed={focus === `pin:${pin.id}`}
                    aria-label={`Pin ${index + 1}: ${pin.label}. ${counts[`pin:${pin.id}`] ?? 0} notes`}
                    onClick={(event) => {
                      event.stopPropagation();
                      choose(`pin:${pin.id}`);
                    }}
                  >
                    {index + 1}
                  </button>
                ))}
                {pending && !pending.page && (
                  <span
                    className="pin is-pending"
                    style={{
                      left: `${pending.x * 100}%`,
                      top: `${pending.y * 100}%`,
                    }}
                    aria-hidden="true"
                  >
                    +
                  </span>
                )}
              </div>
              <figcaption>
                {pinTools}
                <span>
                  Round {round.n}: {round.note}
                </span>
                <Credit credit={session.work.credit} />
              </figcaption>
            </figure>
          )}
          {session.pdf && (
            <div className="canvas">
              <PdfViewer
                src={session.pdf.src}
                name={session.pdf.name}
                pins={pins}
                pending={pending}
                focus={focus}
                counts={counts}
                placing={placing}
                onPlace={(page, x, y) => placeAt(x, y, page)}
                onAnchor={choose}
                onPages={setPageCount}
              />
              <p className="canvas-caption">{pinTools}</p>
            </div>
          )}
          {clip && <MomentPlayer clip={clip} start={start} />}
          {session.blocks && (
            <WorkBlocks
              blocks={session.blocks}
              focus={focus}
              counts={counts}
              onAnchor={choose}
            />
          )}
          {!session.work && (
            <p className="work-round">
              Round {round.n}: {round.note}
            </p>
          )}
        </div>
        <aside className="session-notes" aria-label="Feedback">
          <div
            className="note-filters"
            role="group"
            aria-label="Filter feedback"
          >
            <button
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              All <span>{notes.length}</span>
            </button>
            {noteTypes[session.kind].map((type) => (
              <button
                key={type}
                data-note={type}
                aria-pressed={filter === type}
                onClick={() => setFilter(type)}
              >
                {noteLabels[type]} <span>{typeCounts[type]}</span>
              </button>
            ))}
          </div>
          {focus && (
            <p className="note-focus">
              <MapPin size={13} />
              <span>
                Notes on{" "}
                {focus.startsWith("pin:")
                  ? `pin ${focused?.badge}`
                  : focused?.label.toLowerCase()}
              </span>
              <button className="text-link" onClick={() => setFocus(null)}>
                <X size={13} /> Show all notes
              </button>
            </p>
          )}
          <div className="note-groups">
            {groups.map((group) => (
              <section
                key={group.key}
                className={`note-group ${focus === group.key ? "is-focus" : ""}`}
                aria-label={group.label}
              >
                <h3 className="note-group-head">
                  {group.key === "whole" ? (
                    <span>
                      <span className="note-whole" aria-hidden="true" />
                      {group.label}
                    </span>
                  ) : group.key.startsWith("t:") ? (
                    <a
                      href={`?t=${Math.floor(Number(group.key.slice(2)))}#clip`}
                    >
                      <span className="note-clock">{group.badge}</span>
                      {group.label}
                    </a>
                  ) : (
                    <button onClick={() => choose(group.key)}>
                      <span
                        className={
                          group.key.startsWith("pin:")
                            ? "pin pin-static"
                            : "anchor-tag"
                        }
                      >
                        {group.badge}
                      </span>
                      <span className="note-group-label">
                        {group.label}
                        {group.detail && (
                          <span className="note-group-detail">
                            {group.key.startsWith("step:") ? (
                              <MathText text={group.detail} />
                            ) : (
                              group.detail
                            )}
                          </span>
                        )}
                      </span>
                    </button>
                  )}
                </h3>
                <ul className="note-list">
                  {group.notes.map((note) => {
                    const Icon = noteIcons[note.type];
                    return (
                      <li
                        key={note.id}
                        id={`note-${note.id}`}
                        className={`note ${note.resolved ? "is-resolved" : ""}`}
                        data-note={note.type}
                      >
                        <Icon
                          size={16}
                          className="note-icon"
                          aria-hidden="true"
                        />
                        <div>
                          <p>
                            <span className="note-type">
                              {noteLabels[note.type]}
                            </span>{" "}
                            <MathText text={note.body} />
                          </p>
                          <p className="note-by">
                            <span>{note.alias}</span> {note.role}
                            {note.by && note.by !== viewer?.id && (
                              <ReportButton type="note" id={note.id} />
                            )}
                            {note.resolved ? (
                              <span className="note-done">
                                <Check size={12} /> Resolved
                              </span>
                            ) : (
                              canResolve(note) && (
                                <button
                                  className="note-resolve"
                                  onClick={() => resolve(note)}
                                >
                                  Mark resolved
                                </button>
                              )
                            )}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {!shown.length && (
              <p className="note-empty">
                No notes here yet. Be the first to help.
              </p>
            )}
          </div>
          <form className="note-form" onSubmit={submit}>
            <p className="label">Add to this session</p>
            <div
              className="note-types"
              role="radiogroup"
              aria-label="Kind of note"
            >
              {noteTypes[session.kind].map((type) => (
                <label
                  key={type}
                  data-note={type}
                  className={draft.type === type ? "is-on" : ""}
                >
                  <input
                    type="radio"
                    name="note-type"
                    checked={draft.type === type}
                    onChange={() => setDraft({ ...draft, type })}
                  />
                  {noteLabels[type]}
                </label>
              ))}
            </div>
            {(anchors.length > 0 || pending) && (
              <label className="note-pin">
                <span>Attach to</span>
                <select
                  value={draft.anchor}
                  onChange={(event) =>
                    setDraft({ ...draft, anchor: event.target.value })
                  }
                >
                  <option value="whole">The whole piece</option>
                  {pending && (
                    <option value="pending">
                      The new pin
                      {pending.page ? ` on page ${pending.page}` : ""}
                    </option>
                  )}
                  {anchors.map((anchor) => (
                    <option key={anchor.key} value={anchor.key}>
                      {anchor.key.startsWith("pin:")
                        ? `Pin ${anchor.badge}: ${anchor.label}`
                        : `${anchor.label}${anchor.detail ? `: ${anchor.detail.replace(/\$/g, "").slice(0, 48)}` : ""}`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="sr-only" htmlFor="note-body">
              Your note
            </label>
            <MathInput
              id="note-body"
              rows={3}
              placeholder={
                session.mode === "hints"
                  ? "Point to the problem or ask a guiding question. Maths works between $ signs."
                  : "Be specific: what you see, why it matters, what to try."
              }
              value={draft.body}
              onValue={(body) => setDraft({ ...draft, body })}
            />
            {!viewer && (
              <div className="form-row post-as">
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
                    placeholder="Physics TA"
                    onChange={(e) => setWho({ ...who, role: e.target.value })}
                  />
                </label>
              </div>
            )}
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <div className="note-submit">
              <span>
                {viewer
                  ? `Posting as ${viewer.name}. Everyone can see notes.`
                  : "Everyone can see notes."}
              </span>
              <button
                className="button button-dark"
                disabled={
                  busy ||
                  draft.body.trim().length < 3 ||
                  (!viewer && who.name.trim().length < 2)
                }
              >
                {busy ? "Posting…" : "Add note"}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
