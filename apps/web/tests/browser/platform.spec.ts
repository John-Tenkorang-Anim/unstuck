import { expect, test } from "@playwright/test";
const path = "/entries/33333333-3333-4333-8333-333333333333";

test("lite reading does not request images, posters, or video and preserves the transcript", async ({
  browser,
}) => {
  const context = await browser.newContext({
    extraHTTPHeaders: { "Save-Data": "on" },
  });
  const page = await context.newPage();
  const requested: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/m/"))
      requested.push(request.url());
  });
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A field note with accessible media",
  );
  await expect(page.getByRole("button", { name: /Load video/ })).toBeVisible();
  await expect(page.locator(".media-image img")).toHaveCount(0);
  await expect(page.locator("video")).toHaveCount(0);
  await page.getByText("Read descriptive transcript", { exact: true }).click();
  await expect(page.locator(".media-transcript")).toContainText(
    "A smaller clay pot",
  );
  expect(requested).toEqual([]);
  await context.close();
});

test("standard reading uses intrinsic image sizes and native captioned video without autoplay", async ({
  page,
}) => {
  await page.route("**/m/**", async (route) => {
    if (route.request().url().endsWith(".vtt")) {
      await route.fulfill({
        contentType: "text/vtt",
        body: "WEBVTT\n\n00:00.000 --> 00:02.000\nTwo pots fit together.\n",
      });
    } else {
      await route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAEElEQVR4nGNYsLcJjhhwcgC3dBZ18MucjQAAAABJRU5ErkJggg==",
          "base64",
        ),
      });
    }
  });
  await page.goto(path);
  const image = page.locator(".media-image img");
  await expect(image).toHaveAttribute("alt", /Two clay pots/);
  await expect(image).toHaveAttribute("width", "1600");
  await expect(image).toHaveAttribute("height", "1200");
  await expect(image).toHaveAttribute("loading", "lazy");
  const video = page.locator("video");
  await expect(video).toHaveAttribute("preload", "none");
  await expect(video).toHaveAttribute("controls", "");
  await expect(video).not.toHaveAttribute("autoplay");
  await expect(video.locator('track[kind="captions"]')).toHaveAttribute(
    "srclang",
    "en",
  );
  await expect(video.locator("source")).toHaveAttribute("src", /360.mp4$/);
});

test("photos can fail without hiding the story", async ({ page }) => {
  await page.route("**/m/**", (route) => route.abort());
  await page.goto(path);
  await page.locator(".media-gallery").scrollIntoViewIfNeeded();
  await expect(
    page.getByText(
      "The image couldn’t load. Its description is still available.",
    ),
  ).toBeVisible();
  await expect(page.locator(".story-body")).toContainText(
    "The transcript preserves the details",
  );
});

test("the written note and transcript are readable with JavaScript disabled", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(path);
  await expect(page.locator(".story-body")).toContainText(
    "Test the reading and playback experience.",
  );
  await page.locator(".media-transcript summary").click();
  await expect(page.locator(".media-transcript p")).toBeVisible();
  await context.close();
});

test("phone layout stays within the viewport and navigation opens with an accessible button", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close navigation drawer" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
});

test("the home page loads no media files and omits full entry bodies", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/m/"))
      requests.push(request.url());
  });
  await page.goto("/discover");
  await expect(
    page.getByRole("combobox", { name: "Search, or describe your problem" }),
  ).toBeVisible();
  await expect(page.locator(".dv-feature")).toHaveCount(1);
  expect(requests).toEqual([]);
  expect(await page.content()).not.toContain(
    "The transcript preserves the details even without playback.",
  );
});

test("discussion is a shareable tab and preserves navigation back to the note", async ({
  page,
}) => {
  await page.goto(path);
  const tabs = page.getByRole("navigation", { name: "Attempt" });
  await tabs.getByRole("link", { name: /^Discussion/ }).click();
  await expect(page).toHaveURL(/tab=discussion/);
  await expect(page.locator("#why")).toBeVisible();
  await expect(tabs.getByRole("link", { name: /^Discussion/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await tabs.getByRole("link", { name: "Overview" }).click();
  await expect(page.locator(".story-body")).toBeVisible();
});

for (const width of [390, 1440]) {
  test(`journey previews stay compact and readable at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/discover");
    const journeys = page.locator(".dv-journeys");
    await journeys.scrollIntoViewIfNeeded();
    await expect(journeys.locator(":scope > li")).toHaveCount(3);
    for (const image of await journeys.locator("img").all()) {
      const box = (await image.boundingBox())!;
      expect(box.height).toBeLessThanOrEqual(72);
      expect(box.width).toBeLessThanOrEqual(112);
      expect(box.width).toBeGreaterThan(box.height);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      journeys.getByText("Improve oxygen transfer during microbial scale-up"),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: testInfo.outputPath(`discovery-${width}.png`),
      fullPage: true,
    });
    if (width === 1440) {
      await page.getByRole("button", { name: "Switch to dark theme" }).click();
      await page.screenshot({
        path: testInfo.outputPath("discovery-dark.png"),
        fullPage: true,
      });
    }
  });
}
