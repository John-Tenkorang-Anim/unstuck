import "server-only";
import { Pool, type PoolClient } from "pg";
import { webSchema } from "./schema.server";

export class DatabaseUnavailable extends Error {
  readonly status = 503;
  constructor() {
    super("Shared data is temporarily unavailable. Please try again.");
    this.name = "DatabaseUnavailable";
  }
}

/**
 * PostgreSQL access for community data. One pool per process, shared across
 * Next.js bundles through globalThis. The schema is applied once per process under an advisory lock, so several app processes
 * can start together safely.
 */
const shared = globalThis as typeof globalThis & {
  __unstuckDb?: { pool: Pool; url: string; ready: Promise<void> };
};
export const databaseUrl = () => process.env.DATABASE_URL ?? "";
export const hasDatabase = () => !!databaseUrl();
export const showExamples = () => process.env.UNSTUCK_SHOW_EXAMPLES !== undefined
  ? process.env.UNSTUCK_SHOW_EXAMPLES === 'true'
  : !hasDatabase() && !process.env.UNSTUCK_API_URL;

function connect() {
  const url = databaseUrl();
  if (shared.__unstuckDb?.url === url) return shared.__unstuckDb;
  const pool = new Pool({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 8000,
    query_timeout: 10_000,
    lock_timeout: 3000,
    idle_in_transaction_session_timeout: 10_000,
    allowExitOnIdle: true,
  });
  pool.on("error", () => {
    /* A failed idle client is removed by pg; active requests receive an error. */
  });
  const ready = (async () => {
    const client = await pool.connect();
    try {
      await client.query(
        "SELECT pg_advisory_lock(hashtext('unstuck-web-schema'))",
      );
      await client.query(webSchema);
    } finally {
      await client
        .query("SELECT pg_advisory_unlock(hashtext('unstuck-web-schema'))")
        .catch(() => undefined);
      client.release();
    }
  })();
  ready.catch(() => {
    if (shared.__unstuckDb?.pool === pool) shared.__unstuckDb = undefined;
    void pool.end().catch(() => undefined);
  });
  shared.__unstuckDb = { pool, url, ready };
  return shared.__unstuckDb;
}
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
) {
  const { pool, ready } = connect();
  try {
    await ready;
    if (pool.waitingCount >= 64) throw new DatabaseUnavailable();
    return (await pool.query(sql, params)).rows as T[];
  } catch (error) {
    throw databaseError(error);
  }
}

function databaseError(error: unknown): unknown {
  const code = (error as { code?: string } | null)?.code;
  if (
    error instanceof DatabaseUnavailable ||
    (code && /^(08|53|57P|ECONN|ETIMEDOUT|EHOST|ENET)/.test(code)) ||
    code === "55P03" ||
    code === "57014" ||
    code === "40P01" ||
    /connection timeout|timeout exceeded|Connection terminated|Query read timeout/i.test(
      (error as Error)?.message ?? "",
    )
  )
    return new DatabaseUnavailable();
  return error;
}
/** Run statements in one transaction; anything thrown rolls it back. */
export async function transaction<T>(
  work: (client: PoolClient) => Promise<T>,
  options: { readonly?: boolean } = {},
) {
  const { pool, ready } = connect();
  let client: PoolClient;
  try {
    await ready;
    if (pool.waitingCount >= 64) throw new DatabaseUnavailable();
    client = await pool.connect();
  } catch (error) {
    throw databaseError(error);
  }
  try {
    await client.query(
      options.readonly
        ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY"
        : "BEGIN",
    );
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw databaseError(error);
  } finally {
    client.release();
  }
}
