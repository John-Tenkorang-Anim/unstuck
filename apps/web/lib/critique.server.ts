import "server-only";
import { hasDatabase, query } from "./db.server";
import { sampleSessions, statusLabels, type SessionStatus } from "./sessions";
import type { Account } from "./store.server";

/**
 * Critique as part of someone's notebook: the feedback they gave on other
 * people's work, and the work they shared for feedback, newest first.
 */
export async function myCritiques(account: Account, limit = 50) {
  if (!hasDatabase()) return { given: [], shared: [] };
  const [given, shared] = await Promise.all([
    query<{
      id: string;
      session_id: string;
      body: string;
      resolved: boolean;
      created: Date;
      title: string | null;
    }>(
      `SELECT n.id, n.session_id, left(n.data->>'body', 240) AS body, n.resolved, n.created,
              s.data->>'title' AS title
       FROM web.notes n
       LEFT JOIN web.sessions s ON s.id::text = n.session_id
       WHERE n.owner = $1 AND NOT n.hidden AND (s.owner IS NULL OR s.owner <> $1)
       ORDER BY n.created DESC LIMIT $2`,
      [account.id, limit],
    ),
    query<{
      id: string;
      title: string;
      status: SessionStatus;
      notes: number;
      open: number;
      created: Date;
    }>(
      `SELECT s.id::text, s.data->>'title' AS title, s.status, s.created,
              (SELECT count(*)::int FROM web.notes n WHERE n.session_id = s.id::text AND NOT n.hidden) AS notes,
              (SELECT count(*)::int FROM web.notes n WHERE n.session_id = s.id::text AND NOT n.hidden AND NOT n.resolved) AS open
       FROM web.sessions s WHERE s.owner = $1 ORDER BY s.created DESC LIMIT $2`,
      [account.id, limit],
    ),
  ]);
  return {
    given: given.map((n) => ({
      id: n.id,
      sessionId: n.session_id,
      title:
        n.title ??
        sampleSessions.find((s) => s.id === n.session_id)?.title ??
        "A piece of work",
      body: n.body,
      resolved: n.resolved,
      created: n.created.toISOString(),
    })),
    shared: shared.map((s) => ({
      ...s,
      statusLabel: statusLabels[s.status],
      created: s.created.toISOString(),
    })),
  };
}
