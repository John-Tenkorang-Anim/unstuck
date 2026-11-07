import { cp, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { values } = parseArgs({
  options: {
    port: { type: "string", default: process.env.PORT ?? "3000" },
    hostname: { type: "string", default: "127.0.0.1" },
  },
});
if (
  !/^\d+$/.test(values.port) ||
  Number(values.port) < 1 ||
  Number(values.port) > 65535
) {
  throw new Error("Choose a port between 1 and 65535.");
}
let server;
for (const path of [
  ".next/standalone/apps/web/server.js",
  ".next/standalone/server.js",
]) {
  const candidate = resolve(root, path);
  try {
    await access(candidate);
    server = candidate;
    break;
  } catch {
    /* Try the other supported build layout. */
  }
}
if (!server)
  throw new Error("Build the frontend with npm run build before starting it.");
const destination = dirname(server);
try {
  await access(resolve(root, "public"));
  await cp(resolve(root, "public"), resolve(destination, "public"), {
    recursive: true,
  });
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  // Next.js does not require a public directory; Git omits empty directories.
}
await cp(resolve(root, ".next/static"), resolve(destination, ".next/static"), {
  recursive: true,
});
process.env.PORT = values.port;
process.env.HOSTNAME = values.hostname;
await import(pathToFileURL(server).href);
