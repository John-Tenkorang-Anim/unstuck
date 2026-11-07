import "server-only";
import { hasDatabase, query } from "./db.server";
import {
  sampleSessions,
  sessionById,
  type Session,
  type SessionNote,
} from "./sessions";
import {
  notesFor,
  pinsFor,
  storedSession,
  storedSessions,
  type SharedSession,
  type StoredNote,
} from "./store.server";

type People = Map<string, { name: string; role: string }>;
async function people(ids: string[]): Promise<People> {
  if (!ids.length) return new Map();
  const rows = await query<{ id: string; name: string; role: string }>(
    "SELECT id, name, role FROM web.accounts WHERE id = ANY($1)",
    [[...new Set(ids)]],
  );
  return new Map(rows.map((r) => [r.id, r]));
}
async function fileStatuses(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await query<{ id: string; status: string }>(
    "SELECT id, status FROM web.files WHERE id = ANY($1)",
    [ids],
  );
  return new Map(rows.map((r) => [r.id, r.status]));
}
/**
 * Turn a stored session into the shape the workspace renders. Media that is
 * still waiting for review is shown only to its owner and to moderators.
 */
function present(
  stored: SharedSession,
  authorName: string,
  fileStatus: string | undefined,
  canSeePending: boolean,
): Session {
  const session: Session = { ...stored, author: authorName };
  const media = stored.media;
  const visible =
    fileStatus === "approved" || (fileStatus === "pending" && canSeePending);
  if (media)
    session.mediaState = visible
      ? fileStatus === "pending"
        ? "pending"
        : "ready"
      : fileStatus === "rejected"
        ? "rejected"
        : "held";
  if (!media || !visible) return session;
  const src = `/api/files/${media.file}`;
  if (media.kind === "image")
    session.work = {
      src,
      small: src,
      width: media.width ?? 1200,
      height: media.height ?? 900,
      alt: media.alt,
      credit: { author: authorName, license: "Shared on Unstuck", source: "" },
    };
  if (media.kind === "video")
    session.clip = {
      src,
      type: "",
      bytes: 0,
      duration: media.duration ?? 60,
      title: media.alt,
      moments: media.moments ?? [],
    };
  if (media.kind === "pdf") session.pdf = { src, name: media.alt, bytes: 0 };
  return session;
}
const showNote = (note: StoredNote, names: People): SessionNote => {
  const { sessionId: _s, owner, created: _c, hidden: _h, ...rest } = note;
  return {
    ...rest,
    by: owner,
    alias: names.get(owner)?.name ?? "Someone",
    role: names.get(owner)?.role || "Member",
  };
};

/** Shared sessions for lists and search, with their notes folded in. */
export async function listSharedSessions(): Promise<Session[]> {
  if (!hasDatabase()) return [];
  try {
    const sessions = await storedSessions();
    const notes = await notesFor(sessions.map((s) => s.id));
    const names = await people([
      ...sessions.map((s) => s.owner),
      ...notes.map((n) => n.owner),
    ]);
    const files = await fileStatuses(
      sessions.flatMap((s) => (s.media ? [s.media.file] : [])),
    );
    return sessions.map((s) => {
      const session = present(
        s,
        names.get(s.owner)?.name ?? "Someone",
        s.media && files.get(s.media.file),
        false,
      );
      const own = notes
        .filter((n) => n.sessionId === s.id)
        .map((n) => showNote(n, names));
      return { ...session, rounds: [{ ...session.rounds[0], notes: own }] };
    });
  } catch (error) {
    console.error("Shared sessions are unavailable", error);
    return [];
  }
}
/** A sample or shared session, its shared notes, and who owns it. */
export async function loadSession(
  id: string,
  viewer?: { id: string; moderator: boolean },
) {
  const stored = hasDatabase() ? await storedSession(id) : undefined;
  const sample = stored ? undefined : sessionById(id);
  if (!stored && !sample) return undefined;
  const isOwner = !!viewer && viewer.id === stored?.owner;
  if (stored?.hidden && !isOwner && !viewer?.moderator) return undefined;
  const notes = hasDatabase() ? await notesFor([id]) : [];
  const extraPins = hasDatabase() ? await pinsFor(id) : [];
  const names = await (hasDatabase()
    ? people([...(stored ? [stored.owner] : []), ...notes.map((n) => n.owner)])
    : Promise.resolve(new Map() as People));
  const files = stored?.media
    ? await fileStatuses([stored.media.file])
    : new Map<string, string>();
  const base = stored
    ? present(
        stored,
        names.get(stored.owner)?.name ?? "Someone",
        stored.media && files.get(stored.media.file),
        isOwner || !!viewer?.moderator,
      )
    : sample!;
  return {
    session: { ...base, pins: [...base.pins, ...extraPins] },
    notes: notes.map((n) => showNote(n, names)),
    owner: stored?.owner,
    hidden: !!stored?.hidden,
    sample: !!sample,
  };
}
export const isSample = (id: string) => sampleSessions.some((s) => s.id === id);
