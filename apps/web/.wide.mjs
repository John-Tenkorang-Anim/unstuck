import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome" });
const p = await (
  await b.newContext({ viewport: { width: 390, height: 844 } })
).newPage();
for (const path of process.argv.slice(2)) {
  await p.goto("http://127.0.0.1:3100" + path, { waitUntil: "networkidle" });
  const out = await p.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return (
          r.right > 392 &&
          r.width > 0 &&
          !e.closest(".trail-wrap,.table-wrap,.tabs,.dv-categories,.seg")
        );
      })
      .slice(0, 6)
      .map(
        (e) =>
          `${e.tagName}.${e.className} ${Math.round(e.getBoundingClientRect().right)}`,
      ),
  );
  console.log(path, out);
}
await b.close();
