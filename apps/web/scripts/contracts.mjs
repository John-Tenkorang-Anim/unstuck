import { compileFromFile } from "json-schema-to-typescript";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const [source, destination] of [
  [
    "../../contracts/media/public-manifest-v1.json",
    "lib/contracts/media-v1.ts",
  ],
  ["../../contracts/api/entry-view-v1.json", "lib/contracts/entry-v1.ts"],
]) {
  const text = await compileFromFile(resolve(root, source), {
    bannerComment:
      "/* Generated from the canonical Python schema. Run npm run contracts:generate. */",
    additionalProperties: false,
    ignoreMinAndMaxItems: true,
  });
  const target = resolve(root, destination);
  if (process.argv.includes("--check")) {
    if ((await readFile(target, "utf8").catch(() => "")) !== text)
      throw new Error(`Contract drift: ${destination}`);
  } else await writeFile(target, text);
  console.log(
    `${process.argv.includes("--check") ? "Checked" : "Generated"} ${destination}`,
  );
}
