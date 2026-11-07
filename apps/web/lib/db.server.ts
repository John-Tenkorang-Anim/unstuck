import "server-only";
import { Pool, type PoolClient } from "pg";
import { webSchema } from "./schema.server";

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

function connect() {
  const url = databaseUrl();
  if (shared.__unstuckDb?.url === url) return shared.__unstuckDb;
  const pool = new Pool({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 30_000,
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
  });
  shared.__unstuckDb = { pool, url, ready };
  return shared.__unstuckDb;
}
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
) {
  const { pool, ready } = connect();
  await ready;
  return (await pool.query(sql, params)).rows as T[];
}
/** Run statements in one transaction; anything thrown rolls it back. */
export async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const { pool, ready } = connect();
  await ready;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
