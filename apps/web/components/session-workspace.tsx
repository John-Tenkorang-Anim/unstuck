"use client";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Check, Crosshair, MapPin, X } from "lucide-react";
import {
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

const steps: SessionStatus[] = ["open", "in-review", "revised", "resolved"];
type Local = { pins: Pin[]; notes: SessionNote[]; resolved: string[] };
const empty: Local = { pins: [], notes: [], resolved: [] };

/**
 * One feedback session: the work, the exact places under discussion, and the
 * notes about them. Additions are kept on this device until accounts open.
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
    pin: "",
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
  const shown = notes.filter(
    (note) =>
      (filter === "all" || note.type === filter) &&
      (!focus || note.pin === focus),
  );
  const pinNumber = (id?: string) => pins.findIndex((p) => p.id === id) + 1;
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
    setDraft({ ...draft, pin: pin.id });
    setPlacing(false);
    setFocus(pin.id);
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
      pin: draft.pin || undefined,
    };
    persist({ ...local, notes: [...local.notes, note] });
    setDraft({ ...draft, body: "" });
    notice("Note added. It stays on this device until accounts open.");
  }
  const counts = Object.fromEntries(
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
          {session.work ? (
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
                    className={`pin ${focus === pin.id ? "is-focus" : ""}`}
                    style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
                    aria-pressed={focus === pin.id}
                    aria-label={`Pin ${index + 1}: ${pin.label}. ${notes.filter((n) => n.pin === pin.id).length} notes`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setFocus(focus === pin.id ? null : pin.id);
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
                  {focus && (
                    <button
                      className="text-link"
                      onClick={() => setFocus(null)}
                    >
                      <X size={13} /> Show all notes
                    </button>
                  )}
                </span>
                <span>
                  Round {round.n}: {round.note}
                </span>
                <Credit credit={session.work.credit} />
              </figcaption>
              <ol className="pin-list">
                {pins.map((pin, index) => (
                  <li key={pin.id}>
                    <button
                      onClick={() => setFocus(focus === pin.id ? null : pin.id)}
                    >
                      <span className="pin pin-static">{index + 1}</span>
                      {pin.label}
                    </button>
                  </li>
                ))}
              </ol>
            </figure>
          ) : clip ? (
            <MomentPlayer clip={clip} start={start} />
          ) : null}
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
                {noteLabels[type]} <span>{counts[type]}</span>
              </button>
            ))}
          </div>
          {focus && (
            <p className="note-focus">
              <MapPin size={13} /> Notes on pin {pinNumber(focus)}
            </p>
          )}
          <ul className="note-list">
            {shown.map((note) => (
              <li
                key={note.id}
                id={`note-${note.id}`}
                className={`note ${note.resolved ? "is-resolved" : ""}`}
                data-note={note.type}
              >
                <div className="note-top">
                  <span className="note-type">{noteLabels[note.type]}</span>
                  {note.pin && (
                    <button
                      className="note-anchor"
                      onClick={() => setFocus(note.pin!)}
                    >
                      Pin {pinNumber(note.pin)}
                    </button>
                  )}
                  {note.at !== undefined && (
                    <a
                      className="note-anchor"
                      href={`?t=${Math.floor(note.at)}#clip`}
                    >
                      {clock(note.at)}
                    </a>
                  )}
                  {note.resolved && (
                    <span className="note-done">
                      <Check size={12} /> Resolved
                    </span>
                  )}
                </div>
                <p>{note.body}</p>
                <div className="note-by">
                  <span>{note.alias}</span> {note.role}
                  {!note.resolved && (
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
                </div>
              </li>
            ))}
            {!shown.length && (
              <li className="note-empty">No notes here yet.</li>
            )}
          </ul>
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
            {pins.length > 0 && (
              <label className="note-pin">
                <span>Attach to</span>
                <select
                  value={draft.pin}
                  onChange={(event) =>
                    setDraft({ ...draft, pin: event.target.value })
                  }
                >
                  <option value="">The whole piece</option>
                  {pins.map((pin, index) => (
                    <option key={pin.id} value={pin.id}>
                      Pin {index + 1}: {pin.label}
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
              placeholder="Be specific: what you see, why it matters, what to try."
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
