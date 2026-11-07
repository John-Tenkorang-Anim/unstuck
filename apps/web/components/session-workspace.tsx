"use client";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
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
import { MomentPlayer } from "./moment-player";
import { useNotebook } from "./notebook-provider";
import { Credit } from "./picture";
import { MathText, parseCsv, WorkBlocks } from "./work-blocks";

const noteIcons: Record<NoteType, LucideIcon> = {
  issue: TriangleAlert,
  suggestion: Lightbulb,
  question: CircleHelp,
  strength: ThumbsUp,
  hypothesis: FlaskConical,
  evidence: FileSearch,
};
const steps: SessionStatus[] = ["open", "in-review", "revised", "resolved"];
type Local = { pins: Pin[]; notes: SessionNote[]; resolved: string[] };
const empty: Local = { pins: [], notes: [], resolved: [] };
type Anchor = { key: string; label: string; detail: string; badge: string };

/** Turn an anchor key back into the note fields it stands for. */
function fieldsFor(key: string): Partial<SessionNote> {
  const [kind, value] = key.split(":");
  if (kind === "pin") return { pin: value };
  if (kind === "step") return { step: Number(value) };
  if (kind === "line") return { line: Number(value) };
  if (kind === "row") return { row: Number(value) };
  if (kind === "t") return { at: Number(value) };
  return {};
}

/**
 * One feedback session: the work, the exact places under discussion, and the
 * notes about them, grouped by where they point. Additions stay on this device
 * until accounts open.
 */
export function SessionWorkspace({
  session,
  clip,
  start,
}: {
  session: Session;
  clip?: Clip;
  start?: number;
}) {
  const key = `unstuck:session:${session.id}`;
  const { notice } = useNotebook();
  const [local, setLocal] = useState<Local>(empty);
  const [focus, setFocus] = useState<string | null>(null);
  const [filter, setFilter] = useState<NoteType | "all">("all");
  const [placing, setPlacing] = useState(false);
  const [draft, setDraft] = useState({
    type: noteTypes[session.kind][0],
    anchor: "whole",
    body: "",
  });
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? "null");
      if (stored && Array.isArray(stored.notes))
        setLocal({ ...empty, ...stored });
    } catch {
      /* A fresh session view still works. */
    }
  }, [key]);
  function persist(next: Local) {
    setLocal(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      notice("Browser storage is unavailable. Your note lasts for this visit.");
    }
  }
  const pins = [...session.pins, ...local.pins];
  const round = session.rounds.at(-1)!;
  const notes = useMemo(
    () =>
      [...session.rounds.flatMap((r) => r.notes), ...local.notes].map(
        (note) => ({
          ...note,
          resolved: note.resolved || local.resolved.includes(note.id),
        }),
      ),
    [session.rounds, local],
  );
  // Every addressable place in the work, in reading order.
  const anchors = useMemo(() => {
    const list: Anchor[] = pins.map((pin, i) => ({
      key: `pin:${pin.id}`,
      label: pin.label,
      detail: "",
      badge: String(i + 1),
    }));
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
  }, [pins, session.blocks, notes, clip]);
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
    setDraft((d) => ({ ...d, anchor: next ?? "whole" }));
  }
  function place(event: MouseEvent<HTMLDivElement>) {
    if (!placing) return;
    const box = event.currentTarget.getBoundingClientRect();
    const pin: Pin = {
      id: `local-${Date.now()}`,
      x: Math.min(0.98, Math.max(0.02, (event.clientX - box.left) / box.width)),
      y: Math.min(0.98, Math.max(0.02, (event.clientY - box.top) / box.height)),
      label: "Your pin",
    };
    persist({ ...local, pins: [...local.pins, pin] });
    setPlacing(false);
    setFocus(`pin:${pin.id}`);
    setDraft((d) => ({ ...d, anchor: `pin:${pin.id}` }));
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (draft.body.trim().length < 3) return;
    const note: SessionNote = {
      id: `local-${Date.now()}`,
      alias: "You",
      role: "On this device",
      type: draft.type,
      body: draft.body.trim(),
      ...fieldsFor(draft.anchor),
    };
    persist({ ...local, notes: [...local.notes, note] });
    setDraft({ ...draft, body: "" });
    notice("Note added. It stays on this device until accounts open.");
  }
  const typeCounts = Object.fromEntries(
    noteTypes[session.kind].map((type) => [
      type,
      notes.filter((n) => n.type === type).length,
    ]),
  );
  return (
    <div className="session">
      <header className="session-head">
        <div>
          <p className="session-meta">
            {session.kind === "critique" ? "Critique" : "Inquiry"} ·{" "}
            {session.field} · {session.specialty}
            {session.level ? ` · ${session.level}` : ""}
          </p>
          <h1>{session.title}</h1>
          {session.course && <p className="session-course">{session.course}</p>}
        </div>
        <ol className="session-steps" aria-label="Session status">
          {steps.map((step) => (
            <li
              key={step}
              aria-current={step === session.status ? "step" : undefined}
              className={
                steps.indexOf(step) < steps.indexOf(session.status)
                  ? "is-done"
                  : ""
              }
            >
              {statusLabels[step]}
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
      <div className="session-brief">
        <p>
          <strong className="tint-failed">What went wrong</strong>{" "}
          {session.wentWrong}
        </p>
        <p>
          <strong className="tint-ongoing">What they’re asking</strong>{" "}
          {session.ask}
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
              </div>
              <figcaption>
                <span className="canvas-tools">
                  <button
                    className={`button button-outline ${placing ? "is-active" : ""}`}
                    onClick={() => setPlacing(!placing)}
                    aria-pressed={placing}
                  >
                    <Crosshair size={14} />
                    {placing ? "Click the spot on the image" : "Add a pin"}
                  </button>
                </span>
                <span>
                  Round {round.n}: {round.note}
                </span>
                <Credit credit={session.work.credit} />
              </figcaption>
            </figure>
          )}
          {session.blocks && (
            <>
              <WorkBlocks
                blocks={session.blocks}
                focus={focus}
                counts={counts}
                onAnchor={choose}
              />
              {!session.work && (
                <p className="work-round">
                  Round {round.n}: {round.note}
                </p>
              )}
            </>
          )}
          {!session.work && !session.blocks && clip && (
            <MomentPlayer clip={clip} start={start} />
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
                            {note.resolved ? (
                              <span className="note-done">
                                <Check size={12} /> Resolved
                              </span>
                            ) : (
                              <button
                                className="note-resolve"
                                onClick={() =>
                                  persist({
                                    ...local,
                                    resolved: [...local.resolved, note.id],
                                  })
                                }
                              >
                                Mark resolved
                              </button>
                            )}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {!shown.length && <p className="note-empty">No notes here yet.</p>}
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
            {anchors.length > 0 && (
              <label className="note-pin">
                <span>Attach to</span>
                <select
                  value={draft.anchor}
                  onChange={(event) =>
                    setDraft({ ...draft, anchor: event.target.value })
                  }
                >
                  <option value="whole">The whole piece</option>
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
            <textarea
              id="note-body"
              rows={3}
              placeholder={
                session.mode === "hints"
                  ? "Point to the problem or ask a guiding question. Maths works between $ signs."
                  : "Be specific: what you see, why it matters, what to try."
              }
              value={draft.body}
              onChange={(event) =>
                setDraft({ ...draft, body: event.target.value })
              }
            />
            <div className="note-submit">
              <span>Saved on this device until accounts open.</span>
              <button
                className="button button-dark"
                disabled={draft.body.trim().length < 3}
              >
                Add note
              </button>
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
