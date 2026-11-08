import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome" });
const m = await (
  await b.newContext({ viewport: { width: 390, height: 844 } })
).newPage();
await m.goto(process.env.URL, { waitUntil: "networkidle" });
console.log(
  await m.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter(
        (e) =>
          e.getBoundingClientRect().right > innerWidth + 1 &&
          !e.closest(".dv-categories, .an-table-wrap, .an-tabs"),
      )
      .slice(0, 6)
      .map(
        (e) =>
          `${e.tagName}.${String(e.className).slice(0, 50)} ${Math.round(e.getBoundingClientRect().right)}`,
      ),
  ),
);
await b.close();
