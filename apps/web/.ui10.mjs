import { chromium } from "playwright";
const out = "/tmp/claude-501/shots9";
const base = process.env.BASE ?? "http://127.0.0.1:3100";
const paths = (process.env.PATHS ?? "/discover").split(",");
const b = await chromium.launch({ channel: "chrome" });
const problems = [];
for (const [w, h, tag] of [
  [1440, 900, "d"],
  [390, 844, "m"],
]) {
  const p = await (
    await b.newContext({ viewport: { width: w, height: h } })
  ).newPage();
  p.on("pageerror", (e) => problems.push(`${tag} ${e.message}`));
  p.on(
    "console",
    (m) =>
      m.type() === "error" && problems.push(`${tag} ${m.text().slice(0, 200)}`),
  );
  for (const path of paths) {
    await p.goto(base + path, { waitUntil: "networkidle" });
    await p.waitForTimeout(500);
    const name =
      path.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home";
    await p.screenshot({
      path: `${out}/${tag}-${name}.png`,
      fullPage: tag === "d",
    });
    const wide = await p.evaluate(() => document.documentElement.scrollWidth);
    if (wide > w) problems.push(`${tag} ${path} overflows: ${wide}`);
  }
}
console.log("problems:", problems);
await b.close();
