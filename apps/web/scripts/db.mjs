/**
 * A private PostgreSQL cluster for local development, kept in `.pgdata/` on
 * port 5433 so it never touches another Postgres on this machine.
 *   node scripts/db.mjs start   initialise if needed, start, create the database
 *   node scripts/db.mjs stop
 *   node scripts/db.mjs url     print the connection URL
 * Requires PostgreSQL 16 binaries (initdb, pg_ctl, createdb) on PATH.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const data = resolve(root, ".pgdata");
const port = process.env.UNSTUCK_PG_PORT ?? "5433";
const url = `postgresql://unstuck@127.0.0.1:${port}/unstuck`;
const run = (cmd, args, quiet = false) => {
  const result = spawnSync(cmd, args, { stdio: quiet ? "pipe" : "inherit" });
  if (result.error)
    throw new Error(`${cmd} isn’t on PATH. Install PostgreSQL 16.`);
  return result.status;
};
const action = process.argv[2] ?? "start";
if (action === "url") console.log(url);
else if (action === "stop") run("pg_ctl", ["-D", data, "stop", "-m", "fast"]);
else if (action === "start") {
  if (!existsSync(resolve(data, "PG_VERSION")))
    run("initdb", [
      "-D",
      data,
      "-U",
      "unstuck",
      "--auth=trust",
      "--encoding=UTF8",
      "--no-instructions",
    ]);
  if (run("pg_ctl", ["-D", data, "status"], true) !== 0)
    run("pg_ctl", [
      "-D",
      data,
      "-l",
      resolve(data, "server.log"),
      "-o",
      `-p ${port} -k /tmp -c listen_addresses=127.0.0.1`,
      "-w",
      "start",
    ]);
  run(
    "createdb",
    ["-h", "127.0.0.1", "-p", port, "-U", "unstuck", "unstuck"],
    true,
  );
  console.log(`PostgreSQL is running. Set DATABASE_URL=${url}`);
} else throw new Error(`Unknown action: ${action}`);
