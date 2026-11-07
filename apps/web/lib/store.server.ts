import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { query, transaction } from "./db.server";
import { StoreError } from "./errors.server";
import { HashMatch, scan, type Kind } from "./scan.server";
import { matchHash } from "./hashlist.server";
import { storage } from "./storage.server";
import type {
  Block,
  Pin,
  Session,
  SessionNote,
  SessionStatus,
} from "./sessions";
import type { Entry, Moment } from "./types";

export { StoreError };
export interface Account {
  id: string;
  name: string;
  role: string;
  moderator: boolean;
  suspended: boolean;
  created: string;
}
export interface StoredFile {
  id: string;
  owner: string;
  mime: string;
  bytes: number;
  name: string;
  status: "approved" | "pending" | "rejected" | "blocked";
}
export interface SharedSession extends Session {
  owner: string;
  created: string;
  hidden?: boolean;
  media?: {
    kind: Kind;
    file: string;
    width?: number;
    height?: number;
    alt: string;
    moments?: Moment[];
    duration?: number;
  };
}
export interface StoredNote extends SessionNote {
  sessionId: string;
  owner: string;
  created: string;
  hidden?: boolean;
}
export type TargetType = "session" | "note" | "entry";

export const newId = () => randomUUID();
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
/** Easy to copy by hand: five groups of four, no lookalike characters. */
export function newRecoveryCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(20);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
  return chars.match(/.{4}/g)!.join("-");
}
export const normaliseCode = (code: string) =>
  code.toUpperCase().replace(/[^A-Z0-9]/g, "");

/* Uploaded file bytes stay on disk; PostgreSQL holds who, what and whether it is approved. */
export const dataDir = () =>
  resolve(
    process.env.UNSTUCK_DATA_DIR ||
      join(/* turbopackIgnore: true */ process.cwd(), ".data"),
  );
export const filePath = (id: string) => join(dataDir(), "files", id);

const signatures: { mime: string; kind: Kind; test: (b: Buffer) => boolean }[] =
  [
    {
      mime: "image/jpeg",
      kind: "image",
      test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    },
    {
      mime: "image/png",
      kind: "image",
      test: (b) =>
        b
          .subarray(0, 8)
          .equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          ),
    },
    {
      mime: "image/webp",
      kind: "image",
      test: (b) =>
        b.toString("latin1", 0, 4) === "RIFF" &&
        b.toString("latin1", 8, 12) === "WEBP",
    },
    {
      mime: "video/mp4",
      kind: "video",
      test: (b) => b.toString("latin1", 4, 8) === "ftyp",
    },
    {
      mime: "video/webm",
      kind: "video",
      test: (b) =>
        b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])),
    },
    {
      mime: "application/pdf",
      kind: "pdf",
      test: (b) => b.toString("latin1", 0, 5) === "%PDF-",
    },
  ];
export const sizeLimits = { image: 15e6, video: 100e6, pdf: 20e6 };
/** Identify a file by its first bytes, never by its name or declared type. */
export const sniff = (bytes: Buffer) => signatures.find((s) => s.test(bytes));

export async function saveFile(owner: string, name: string, input: Buffer) {
  const type = sniff(input);
  if (!type)
    throw new StoreError(
      "Only JPEG, PNG, WebP, MP4, WebM and PDF files can be shared.",
    );
  if (input.length > sizeLimits[type.kind])
    throw new StoreError(
      `That ${type.kind === "pdf" ? "PDF" : type.kind} is over the size limit.`,
    );
  let checked;
  try {
    checked = await scan(type.kind, type.mime, input);
  } catch (error) {
    if (!(error instanceof HashMatch)) throw error;
    await quarantine(owner, name, type.mime, input, error);
    // Say nothing that would help someone probe the list.
    throw new StoreError("This file can’t be shared.", 400);
  }
  const file: StoredFile = {
    id: newId(),
    owner,
    mime: type.mime,
    bytes: checked.bytes.length,
    name: name.slice(0, 120) || "upload",
    status: checked.status,
  };
  await storage().put("files", file.id, checked.bytes, file.mime);
  await query(
    "INSERT INTO web.files (id, owner, mime, bytes, name, status, scan, pdq) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      file.id,
      owner,
      file.mime,
      file.bytes,
      file.name,
      file.status,
      checked.note,
      checked.pdq ?? null,
    ],
  );
  return { file, kind: type.kind };
}
/**
 * Keep a matched upload as evidence where nothing can serve it, suspend the
 * account, and open an incident for moderators to report.
 */
async function quarantine(
  owner: string,
  name: string,
  mime: string,
  bytes: Buffer,
  match: HashMatch,
) {
  const id = newId();
  await storage().put("quarantine", id, bytes, mime);
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO web.files (id, owner, mime, bytes, name, status, scan, pdq, quarantined)
       VALUES ($1,$2,$3,$4,$5,'blocked',$6,$7,true)`,
      [
        id,
        owner,
        mime,
        bytes.length,
        name.slice(0, 120) || "upload",
        `hash match: ${match.label}`,
        match.pdq,
      ],
    );
    await client.query(
      "INSERT INTO web.incidents (id, file_id, account_id, matched, distance) VALUES ($1,$2,$3,$4,$5)",
      [newId(), id, owner, match.label, match.distance],
    );
    await client.query(
      "UPDATE web.accounts SET suspended = true WHERE id = $1",
      [owner],
    );
  });
}
/** Check every stored image against the current hash list, after the list changes. */
export async function recheckUploads(moderator: Account) {
  if (!moderator.moderator)
    throw new StoreError("Only moderators can do that.", 403);
  const files = await query<{
    id: string;
    owner: string;
    mime: string;
    pdq: string;
  }>(
    "SELECT id, owner, mime, pdq FROM web.files WHERE pdq IS NOT NULL AND status <> 'blocked'",
  );
  let matched = 0;
  for (const file of files) {
    const match = await matchHash(file.pdq);
    if (!match) continue;
    matched++;
    const { stream } = await storage().get("files", file.id);
    const bytes = Buffer.from(await new Response(stream).arrayBuffer());
    await storage().put("quarantine", file.id, bytes, file.mime);
    await storage().remove("files", file.id);
    await transaction(async (client) => {
      await client.query(
        "UPDATE web.files SET status = 'blocked', quarantined = true, scan = $2 WHERE id = $1",
        [file.id, `hash match: ${match.label}`],
      );
      await client.query(
        "INSERT INTO web.incidents (id, file_id, account_id, matched, distance) VALUES ($1,$2,$3,$4,$5)",
        [newId(), file.id, file.owner, match.label, match.distance],
      );
      await client.query(
        "UPDATE web.accounts SET suspended = true WHERE id = $1",
        [file.owner],
      );
    });
  }
  await query(
    "INSERT INTO web.moderation_actions (id, moderator, target_type, target_id, action, note) VALUES ($1,$2,'files','all','recheck',$3)",
    [
      newId(),
      moderator.id,
      `Checked ${files.length} uploads against the hash list; ${matched} matched.`,
    ],
  );
  return { checked: files.length, matched };
}
export async function openIncidents() {
  return query<{
    id: string;
    matched: string;
    distance: number;
    created: Date;
    account: string;
    reported_at: Date | null;
    report_reference: string | null;
  }>(
    `SELECT i.id, i.matched, i.distance, i.created, a.name AS account, i.reported_at, i.report_reference
     FROM web.incidents i JOIN web.accounts a ON a.id = i.account_id
     ORDER BY i.reported_at IS NOT NULL, i.created DESC LIMIT 100`,
  );
}
export async function recordIncidentReport(
  moderator: Account,
  id: string,
  reference: string,
) {
  if (!moderator.moderator)
    throw new StoreError("Only moderators can do that.", 403);
  const ref = text(reference, 3, 120, "The report reference");
  const rows = await query(
    "UPDATE web.incidents SET reported_by = $2, report_reference = $3, reported_at = now() WHERE id = $1 RETURNING id",
    [id, moderator.id, ref],
  );
  if (!rows.length) throw new StoreError("Incident not found.", 404);
}
export async function fileById(id: string) {
  const [file] = await query<StoredFile>(
    "SELECT id, owner, mime, bytes, name, status FROM web.files WHERE id = $1",
    [id],
  );
  return file;
}

/* Rate limits ------------------------------------------------------------- */
export const limits = {
  account: { max: 10, seconds: 3600 },
  recover: { max: 10, seconds: 3600 },
  session: { max: 10, seconds: 3600 },
  entry: { max: 10, seconds: 3600 },
  note: { max: 60, seconds: 3600 },
  report: { max: 20, seconds: 3600 },
};
/**
 * Count recent events for a key and refuse once the window is full. The
 * advisory lock makes the check-and-insert atomic across app processes.
 */
export async function rateLimit(kind: keyof typeof limits, who: string) {
  const { seconds } = limits[kind];
  // Tests raise the ceiling; production uses the limits as written.
  const max = Math.ceil(
    limits[kind].max * Number(process.env.UNSTUCK_RATE_LIMIT_SCALE || 1),
  );
  const key = `${kind}:${who}`;
  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);
    await client.query(
      "DELETE FROM web.rate_events WHERE key = $1 AND at < now() - make_interval(secs => $2)",
      [key, seconds],
    );
    const { rows } = await client.query(
      "SELECT count(*)::int AS n FROM web.rate_events WHERE key = $1",
      [key],
    );
    if (rows[0].n >= max)
      throw new StoreError(
        "That’s a lot in a short time. Please wait a while and try again.",
        429,
      );
    await client.query("INSERT INTO web.rate_events (key) VALUES ($1)", [key]);
  });
}

/* Accounts --------------------------------------------------------------- */
const accountColumns =
  "a.id, a.name, a.role, a.moderator, a.suspended, a.created";
export async function insertAccount(name: string, role: string) {
  const account = { id: newId(), name, role };
  const token = newToken();
  const recovery = newRecoveryCode();
  await transaction(async (client) => {
    await client.query(
      "INSERT INTO web.accounts (id, name, role) VALUES ($1,$2,$3)",
      [account.id, name, role],
    );
    await client.query(
      "INSERT INTO web.tokens (token_hash, account_id) VALUES ($1,$2)",
      [hashToken(token), account.id],
    );
    await client.query(
      "INSERT INTO web.recovery_codes (code_hash, account_id) VALUES ($1,$2)",
      [hashToken(normaliseCode(recovery)), account.id],
    );
  });
  return { account, token, recovery };
}
export async function accountByToken(token: string) {
  const [account] = await query<Account>(
    `SELECT ${accountColumns} FROM web.tokens t JOIN web.accounts a ON a.id = t.account_id WHERE t.token_hash = $1`,
    [hashToken(token)],
  );
  return account;
}
export const accountById = async (id: string) =>
  (
    await query<Account>(
      `SELECT ${accountColumns} FROM web.accounts a WHERE a.id = $1`,
      [id],
    )
  )[0];
export async function dropToken(token: string) {
  await query("DELETE FROM web.tokens WHERE token_hash = $1", [
    hashToken(token),
  ]);
}
/** Replace an account's recovery code; the old one stops working. */
export async function rotateRecovery(accountId: string) {
  const code = newRecoveryCode();
  await transaction(async (client) => {
    await client.query("DELETE FROM web.recovery_codes WHERE account_id = $1", [
      accountId,
    ]);
    await client.query(
      "INSERT INTO web.recovery_codes (code_hash, account_id) VALUES ($1,$2)",
      [hashToken(normaliseCode(code)), accountId],
    );
  });
  return code;
}
/** Exchange a recovery code for a new sign-in on this browser. The code stays valid. */
export async function recover(code: string) {
  const [row] = await query<{ account_id: string }>(
    "SELECT account_id FROM web.recovery_codes WHERE code_hash = $1",
    [hashToken(normaliseCode(code))],
  );
  if (!row)
    throw new StoreError("That recovery code doesn’t match an account.", 400);
  const token = newToken();
  await query(
    "INSERT INTO web.tokens (token_hash, account_id) VALUES ($1,$2)",
    [hashToken(token), row.account_id],
  );
  return { token, account: await accountById(row.account_id) };
}
export async function makeModerator(accountId: string) {
  await query("UPDATE web.accounts SET moderator = true WHERE id = $1", [
    accountId,
  ]);
}

/* Validation ------------------------------------------------------------- */
const text = (value: unknown, min: number, max: number, label: string) => {
  const s = typeof value === "string" ? value.trim() : "";
  if (s.length < min) throw new StoreError(`${label} is too short.`);
  if (s.length > max) throw new StoreError(`${label} is too long.`);
  return s;
};
export const clean = { text };
export function cleanBlocks(value: unknown): Block[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 6)
    throw new StoreError("Too many working blocks.");
  return value.map((raw): Block => {
    const b = raw as Record<string, unknown>;
    const title = text(b.title, 1, 80, "A block title");
    if (b.kind === "steps") {
      if (!Array.isArray(b.steps) || !b.steps.length || b.steps.length > 40)
        throw new StoreError("Steps need between 1 and 40 entries.");
      return {
        kind: "steps",
        title,
        steps: b.steps.map((s) => text(s, 1, 2000, "A step")),
      };
    }
    if (b.kind === "code")
      return {
        kind: "code",
        title,
        language: text(b.language || "Code", 1, 40, "The language"),
        code: text(b.code, 1, 20000, "The code"),
        output:
          typeof b.output === "string" ? b.output.slice(0, 5000) : undefined,
        expected:
          typeof b.expected === "string"
            ? b.expected.slice(0, 5000)
            : undefined,
      };
    if (b.kind === "data") {
      const csv = text(b.csv, 3, 20000, "The data");
      const rows = csv.split(/\r?\n/);
      if (rows.length > 201 || rows.some((r) => r.split(",").length > 20))
        throw new StoreError(
          "Data tables can have up to 200 rows and 20 columns.",
        );
      return {
        kind: "data",
        title,
        csv,
        note: typeof b.note === "string" ? b.note.slice(0, 300) : undefined,
      };
    }
    throw new StoreError("Unknown working block.");
  });
}
export function cleanPins(value: unknown): Pin[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20)
    throw new StoreError("Too many pins.");
  return value.map((raw, i) => cleanPin(raw, `p${i + 1}`));
}
export function cleanPin(raw: unknown, id: string): Pin {
  const p = raw as Record<string, unknown>;
  const x = Number(p.x),
    y = Number(p.y);
  if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1))
    throw new StoreError("A pin is outside the work.");
  const page = p.page === undefined ? undefined : Number(p.page);
  if (
    page !== undefined &&
    !(Number.isInteger(page) && page >= 1 && page <= 500)
  )
    throw new StoreError("A pin is on an unknown page.");
  return {
    id,
    x,
    y,
    label: text(p.label || "Pinned spot", 1, 120, "A pin label"),
    ...(page ? { page } : {}),
  };
}
export function cleanMoments(value: unknown): Moment[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20)
    throw new StoreError("Too many marked moments.");
  return value.map((raw) => {
    const m = raw as Record<string, unknown>;
    const at = Number(m.at);
    if (!(at >= 0 && at <= 3600))
      throw new StoreError("A moment is outside the video.");
    const kind = m.kind === "worked" || m.kind === "note" ? m.kind : "broke";
    return {
      at,
      kind,
      label: text(m.label || "Marked moment", 1, 160, "A moment label"),
    };
  });
}

/* Sessions, pins and notes ----------------------------------------------- */
type Row = {
  id: string;
  owner: string;
  data: Record<string, unknown>;
  status: SessionStatus;
  hidden: boolean;
  created: Date;
};
const toSession = (row: Row): SharedSession =>
  ({
    ...row.data,
    id: row.id,
    owner: row.owner,
    status: row.status,
    hidden: row.hidden,
    created: row.created.toISOString(),
  }) as SharedSession;
export async function insertSession(session: SharedSession) {
  const { id, owner, status, created: _c, hidden: _h, ...data } = session;
  await query(
    "INSERT INTO web.sessions (id, owner, data, status) VALUES ($1,$2,$3,$4)",
    [id, owner, data, status],
  );
}
const isUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
export async function storedSession(id: string) {
  if (!isUuid(id)) return undefined;
  const [row] = await query<Row>("SELECT * FROM web.sessions WHERE id = $1", [
    id,
  ]);
  return row ? toSession(row) : undefined;
}
export async function storedSessions(includeHidden = false) {
  return (
    await query<Row>(
      `SELECT * FROM web.sessions ${includeHidden ? "" : "WHERE NOT hidden"} ORDER BY created DESC LIMIT 200`,
    )
  ).map(toSession);
}
export async function setSessionStatus(
  id: string,
  owner: string,
  status: SessionStatus,
) {
  const rows = await query(
    "UPDATE web.sessions SET status = $3 WHERE id = $1 AND owner = $2 RETURNING id",
    [id, owner, status],
  );
  if (!rows.length)
    throw new StoreError(
      "Only the person who opened this session can change it.",
      403,
    );
}
export async function pinsFor(sessionId: string) {
  return (
    await query<{ data: Pin }>(
      "SELECT data FROM web.pins WHERE session_id = $1 ORDER BY created",
      [sessionId],
    )
  ).map((r) => r.data);
}
type NoteRow = {
  id: string;
  session_id: string;
  owner: string;
  data: Record<string, unknown>;
  resolved: boolean;
  hidden: boolean;
  created: Date;
};
const toNote = (row: NoteRow): StoredNote =>
  ({
    ...row.data,
    id: row.id,
    sessionId: row.session_id,
    owner: row.owner,
    resolved: row.resolved,
    hidden: row.hidden,
    created: row.created.toISOString(),
  }) as StoredNote;
export async function notesFor(sessionIds: string[], includeHidden = false) {
  if (!sessionIds.length) return [];
  return (
    await query<NoteRow>(
      `SELECT * FROM web.notes WHERE session_id = ANY($1) ${includeHidden ? "" : "AND NOT hidden"} ORDER BY created`,
      [sessionIds],
    )
  ).map(toNote);
}
/** Store a note, and the new pin it brings, in one transaction. */
export async function insertNote(note: StoredNote, pin?: Pin) {
  const {
    id,
    sessionId,
    owner,
    created: _c,
    resolved: _r,
    hidden: _h,
    ...data
  } = note;
  await transaction(async (client) => {
    if (pin)
      await client.query(
        "INSERT INTO web.pins (id, session_id, owner, data) VALUES ($1,$2,$3,$4)",
        [pin.id, sessionId, owner, pin],
      );
    await client.query(
      "INSERT INTO web.notes (id, session_id, owner, data) VALUES ($1,$2,$3,$4)",
      [id, sessionId, owner, data],
    );
    if (isUuid(sessionId))
      await client.query(
        "UPDATE web.sessions SET status = 'in-review' WHERE id = $1 AND status = 'open' AND owner <> $2",
        [sessionId, owner],
      );
  });
}
export async function resolveNote(id: string, accountId: string) {
  const rows = await query(
    `UPDATE web.notes n SET resolved = true
     WHERE n.id = $1 AND (n.owner = $2 OR EXISTS (SELECT 1 FROM web.sessions s WHERE s.id::text = n.session_id AND s.owner = $2))
     RETURNING n.id`,
    [isUuid(id) ? id : "00000000-0000-0000-0000-000000000000", accountId],
  );
  if (!rows.length)
    throw new StoreError(
      "Only the session owner or the note’s author can resolve it.",
      403,
    );
}

/* Field notes ------------------------------------------------------------ */
type EntryRow = {
  id: string;
  owner: string;
  data: Entry;
  hidden: boolean;
  created: Date;
};
export async function insertEntry(entry: Entry, owner: string) {
  await query("INSERT INTO web.entries (id, owner, data) VALUES ($1,$2,$3)", [
    entry.id,
    owner,
    entry,
  ]);
}
export async function storedEntries(includeHidden = false) {
  return (
    await query<EntryRow>(
      `SELECT * FROM web.entries ${includeHidden ? "" : "WHERE NOT hidden"} ORDER BY created DESC LIMIT 200`,
    )
  ).map((r) => ({ ...r.data, id: r.id, owner: r.owner, hidden: r.hidden }));
}
export async function storedEntry(id: string) {
  if (!isUuid(id)) return undefined;
  const [row] = await query<EntryRow>(
    "SELECT * FROM web.entries WHERE id = $1",
    [id],
  );
  return row
    ? { ...row.data, id: row.id, owner: row.owner, hidden: row.hidden }
    : undefined;
}

/* Reports and moderation ------------------------------------------------- */
export const AUTO_HIDE_REPORTS = 3;
const tables: Record<TargetType, string> = {
  session: "web.sessions",
  note: "web.notes",
  entry: "web.entries",
};
/**
 * File a report. Each person can report a thing once. When enough different
 * people report it, it is hidden until a moderator reviews it.
 */
export async function fileReport(
  type: TargetType,
  id: string,
  reporter: string,
  reason: string,
) {
  if (!isUuid(id))
    throw new StoreError("Only shared content can be reported.", 404);
  return transaction(async (client) => {
    const exists = await client.query(
      `SELECT 1 FROM ${tables[type]} WHERE id = $1`,
      [id],
    );
    if (!exists.rowCount) throw new StoreError("That no longer exists.", 404);
    await client.query(
      `INSERT INTO web.reports (id, target_type, target_id, reporter, reason) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (target_type, target_id, reporter) DO NOTHING`,
      [newId(), type, id, reporter, reason],
    );
    const { rows } = await client.query(
      "SELECT count(*)::int AS n FROM web.reports WHERE target_type = $1 AND target_id = $2 AND NOT resolved",
      [type, id],
    );
    const hidden = rows[0].n >= AUTO_HIDE_REPORTS;
    if (hidden)
      await client.query(
        `UPDATE ${tables[type]} SET hidden = true WHERE id = $1`,
        [id],
      );
    return { hidden };
  });
}
export type ModerationAction =
  | "hide"
  | "restore"
  | "approve-file"
  | "reject-file"
  | "suspend"
  | "unsuspend"
  | "dismiss";
/** Apply a moderator's decision, record why, and close the related reports. */
export async function moderate(
  moderator: Account,
  action: ModerationAction,
  type: string,
  id: string,
  note: string,
) {
  if (!moderator.moderator)
    throw new StoreError("Only moderators can do that.", 403);
  if (note.trim().length < 10)
    throw new StoreError("Explain the decision in at least 10 characters.");
  await transaction(async (client) => {
    let changed = 0;
    if (action === "hide" || action === "restore") {
      if (!(type in tables)) throw new StoreError("Unknown content type.");
      changed =
        (
          await client.query(
            `UPDATE ${tables[type as TargetType]} SET hidden = $2 WHERE id = $1`,
            [id, action === "hide"],
          )
        ).rowCount ?? 0;
    } else if (action === "approve-file" || action === "reject-file") {
      changed =
        (
          await client.query("UPDATE web.files SET status = $2 WHERE id = $1", [
            id,
            action === "approve-file" ? "approved" : "rejected",
          ])
        ).rowCount ?? 0;
    } else if (action === "suspend" || action === "unsuspend") {
      changed =
        (
          await client.query(
            "UPDATE web.accounts SET suspended = $2 WHERE id = $1 AND NOT moderator",
            [id, action === "suspend"],
          )
        ).rowCount ?? 0;
    } else if (action === "dismiss") changed = 1;
    if (!changed)
      throw new StoreError("Nothing was changed. It may already be gone.", 404);
    await client.query(
      "UPDATE web.reports SET resolved = true WHERE target_id = $1",
      [id],
    );
    await client.query(
      "INSERT INTO web.moderation_actions (id, moderator, target_type, target_id, action, note) VALUES ($1,$2,$3,$4,$5,$6)",
      [newId(), moderator.id, type, id, action, note.trim()],
    );
  });
}
export async function moderationQueue() {
  const reports = await query<{
    target_type: TargetType;
    target_id: string;
    reasons: string[];
    count: number;
    latest: Date;
  }>(
    `SELECT target_type, target_id, array_agg(reason ORDER BY created) AS reasons, count(*)::int AS count, max(created) AS latest
     FROM web.reports WHERE NOT resolved GROUP BY target_type, target_id ORDER BY count(*) DESC, max(created) DESC LIMIT 100`,
  );
  const files = await query<StoredFile & { owner_name: string; scan: string }>(
    `SELECT f.id, f.owner, f.mime, f.bytes, f.name, f.status, f.scan, a.name AS owner_name
     FROM web.files f JOIN web.accounts a ON a.id = f.owner WHERE f.status = 'pending' ORDER BY f.created LIMIT 100`,
  );
  const actions = await query<{
    action: string;
    target_type: string;
    note: string;
    created: Date;
    moderator: string;
  }>(
    `SELECT m.action, m.target_type, m.note, m.created, a.name AS moderator
     FROM web.moderation_actions m JOIN web.accounts a ON a.id = m.moderator ORDER BY m.created DESC LIMIT 30`,
  );
  return { reports, files, actions };
}
/** A short preview of reported content, for the moderation queue. */
export async function preview(type: TargetType, id: string) {
  const [row] = await query<{
    data: Record<string, unknown>;
    owner: string;
    hidden: boolean;
    name: string;
  }>(
    `SELECT t.data, t.owner, t.hidden, a.name FROM ${tables[type]} t JOIN web.accounts a ON a.id = t.owner WHERE t.id = $1`,
    [id],
  );
  if (!row) return undefined;
  const d = row.data;
  return {
    title: String(d.title ?? d.body ?? ""),
    body: String(d.wentWrong ?? d.excerpt ?? (d.title ? "" : "")),
    owner: row.owner,
    ownerName: row.name,
    hidden: row.hidden,
    sessionId:
      type === "note"
        ? String(
            (
              await query<{ session_id: string }>(
                "SELECT session_id FROM web.notes WHERE id = $1",
                [id],
              )
            )[0]?.session_id,
          )
        : undefined,
  };
}

/* Appeals ---------------------------------------------------------------- */
export type AppealTarget = TargetType | "account";
export interface Appeal {
  id: string;
  target_type: AppealTarget;
  target_id: string;
  statement: string;
  status: "open" | "upheld" | "overturned";
  decision_note: string | null;
  created: Date;
}
/** Why something was hidden or suspended, in words the person can read. */
async function reasonFor(type: AppealTarget, id: string) {
  const [action] = await query<{
    note: string;
    action: string;
    moderator: string;
  }>(
    `SELECT note, action, moderator FROM web.moderation_actions
     WHERE target_type = $1 AND target_id = $2 AND action IN ('hide', 'suspend') ORDER BY created DESC LIMIT 1`,
    [type, id],
  );
  if (action)
    return {
      reason: `A moderator wrote: “${action.note}”`,
      moderator: action.moderator,
    };
  if (type === "account") {
    const [incident] = await query(
      "SELECT 1 FROM web.incidents WHERE account_id = $1 LIMIT 1",
      [id],
    );
    return {
      reason: incident
        ? "An upload matched a list of prohibited images. A moderator will review it."
        : "This account was suspended.",
      moderator: undefined,
    };
  }
  return {
    reason: `Hidden automatically after ${AUTO_HIDE_REPORTS} people reported it.`,
    moderator: undefined,
  };
}
/** Everything of this person's that is hidden, and whether they are suspended. */
export async function standing(account: Account) {
  const hidden = await query<{ type: TargetType; id: string; title: string }>(
    `SELECT 'session' AS type, id::text, data->>'title' AS title FROM web.sessions WHERE owner = $1 AND hidden
     UNION ALL SELECT 'entry', id::text, data->>'title' FROM web.entries WHERE owner = $1 AND hidden
     UNION ALL SELECT 'note', id::text, left(data->>'body', 120) FROM web.notes WHERE owner = $1 AND hidden`,
    [account.id],
  );
  const appeals = await query<Appeal>(
    "SELECT id, target_type, target_id, statement, status, decision_note, created FROM web.appeals WHERE appellant = $1 ORDER BY created DESC",
    [account.id],
  );
  const items = await Promise.all(
    [
      ...(account.suspended
        ? [{ type: "account" as const, id: account.id, title: "Your account" }]
        : []),
      ...hidden,
    ].map(async (item) => ({
      ...item,
      reason: (await reasonFor(item.type, item.id)).reason,
      appeal: appeals.find(
        (a) => a.target_type === item.type && a.target_id === item.id,
      ),
    })),
  );
  return { items, appeals };
}
/** One appeal per person per hidden item or suspension. */
export async function fileAppeal(
  account: Account,
  type: AppealTarget,
  id: string,
  statement: string,
) {
  const words = text(statement, 20, 2000, "Your appeal");
  const { items } = await standing(account);
  if (!items.some((item) => item.type === type && item.id === id))
    throw new StoreError(
      "You can only appeal your own hidden content or a suspension of your account.",
      403,
    );
  const rows = await query(
    `INSERT INTO web.appeals (id, target_type, target_id, appellant, statement) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (target_type, target_id, appellant) DO NOTHING RETURNING id`,
    [newId(), type, id, account.id, words],
  );
  if (!rows.length)
    throw new StoreError(
      "You’ve already appealed this. Each decision can be appealed once.",
      409,
    );
}
export async function openAppeals() {
  const appeals = await query<
    Appeal & { appellant_name: string; appellant: string }
  >(
    `SELECT p.id, p.target_type, p.target_id, p.statement, p.status, p.decision_note, p.created, p.appellant, a.name AS appellant_name
     FROM web.appeals p JOIN web.accounts a ON a.id = p.appellant WHERE p.status = 'open' ORDER BY p.created LIMIT 100`,
  );
  return Promise.all(
    appeals.map(async (appeal) => ({
      ...appeal,
      ...(await reasonFor(appeal.target_type, appeal.target_id)),
    })),
  );
}
/**
 * Decide an appeal. Overturning restores the content or lifts the suspension.
 * A moderator can't decide an appeal against their own action while another
 * moderator exists.
 */
export async function decideAppeal(
  moderator: Account,
  id: string,
  decision: "uphold" | "overturn",
  note: string,
) {
  if (!moderator.moderator)
    throw new StoreError("Only moderators can do that.", 403);
  const why = text(note, 10, 500, "The explanation");
  const [appeal] = await query<Appeal>(
    "SELECT * FROM web.appeals WHERE id = $1 AND status = 'open'",
    [id],
  );
  if (!appeal)
    throw new StoreError(
      "That appeal is already decided or doesn’t exist.",
      404,
    );
  const original = await reasonFor(appeal.target_type, appeal.target_id);
  if (original.moderator === moderator.id) {
    const [other] = await query(
      "SELECT 1 FROM web.accounts WHERE moderator AND id <> $1 LIMIT 1",
      [moderator.id],
    );
    if (other)
      throw new StoreError(
        "A different moderator should decide an appeal against your own decision.",
        403,
      );
  }
  await transaction(async (client) => {
    if (decision === "overturn") {
      if (appeal.target_type === "account")
        await client.query(
          "UPDATE web.accounts SET suspended = false WHERE id = $1",
          [appeal.target_id],
        );
      else
        await client.query(
          `UPDATE ${tables[appeal.target_type]} SET hidden = false WHERE id = $1`,
          [appeal.target_id],
        );
      await client.query(
        "UPDATE web.reports SET resolved = true WHERE target_id = $1",
        [appeal.target_id],
      );
    }
    await client.query(
      "UPDATE web.appeals SET status = $2, decided_by = $3, decision_note = $4, decided = now() WHERE id = $1",
      [
        id,
        decision === "overturn" ? "overturned" : "upheld",
        moderator.id,
        why,
      ],
    );
    await client.query(
      "INSERT INTO web.moderation_actions (id, moderator, target_type, target_id, action, note) VALUES ($1,$2,$3,$4,$5,$6)",
      [
        newId(),
        moderator.id,
        appeal.target_type,
        appeal.target_id,
        `appeal-${decision === "overturn" ? "overturned" : "upheld"}`,
        why,
      ],
    );
  });
}
