/**
 * Create a throwaway PostgreSQL database for a test run and drop it afterwards.
 * Uses UNSTUCK_TEST_DATABASE_URL (CI) or the local cluster from `npm run db:start`.
 */
import pg from "pg";

const admin =
  process.env.UNSTUCK_TEST_DATABASE_URL ??
  "postgresql://unstuck@127.0.0.1:5433/unstuck";
export async function createTestDatabase() {
  const name = `unstuck_t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const client = new pg.Client({ connectionString: admin });
  try {
    await client.connect();
  } catch {
    throw new Error(
      "Tests need PostgreSQL. Run `npm run db:start`, or set UNSTUCK_TEST_DATABASE_URL.",
    );
  }
  await client.query(`CREATE DATABASE ${name}`);
  await client.end();
  const url = new URL(admin);
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    async drop() {
      const c = new pg.Client({ connectionString: admin });
      await c.connect();
      await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await c.end();
    },
  };
}
