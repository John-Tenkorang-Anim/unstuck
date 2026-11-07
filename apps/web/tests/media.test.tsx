import rejectionCases from "../../../contracts/media/fixtures/invalid-cases.json";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import imageFixture from "../../../contracts/media/fixtures/image-v1.json";
import videoFixture from "../../../contracts/media/fixtures/video-v1.json";
import entryFixture from "../../../contracts/media/fixtures/entry-v1.json";
import {
  parseAttachments,
  parseEntry,
  parseMedia,
} from "@/lib/platform/contracts.server";
import { readJson, PlatformUnavailable } from "@/lib/platform/http";
import { mediaUrl } from "@/lib/media/delivery";
import { readingPolicy } from "@/lib/media/reading-policy";
import { MediaGallery } from "@/components/media/media-gallery";
import { NotebookProvider } from "@/components/notebook-provider";
import { ResponsiveImage } from "@/components/media/responsive-image";
import { AccessibleVideo } from "@/components/media/accessible-video";
import { summarizeEntry } from "@/lib/types";
import { examples } from "@/lib/data";

const image = parseMedia(imageFixture);
const video = parseMedia(videoFixture);
if (!image || image.kind !== "image" || !video || video.kind !== "video")
  throw new Error("Shared fixtures must validate");
const imageMedia = image;
const videoMedia = video;

describe("versioned media contracts", () => {
  it.each(rejectionCases)(
    "shares Python semantic rejection: $name",
    (testCase) => {
      const value = structuredClone(
        testCase.fixture === "image" ? imageFixture : videoFixture,
      );
      for (const change of testCase.changes) {
        let target: Record<string | number, unknown> =
          value as unknown as Record<string | number, unknown>;
        for (const key of change.path.slice(0, -1))
          target = target[key] as Record<string | number, unknown>;
        target[change.path.at(-1)!] = change.value;
      }
      expect(parseMedia(value)).toBeUndefined();
    },
  );
  it("accepts portrait renditions within the same decode budget", () => {
    const portrait = structuredClone(videoFixture);
    for (const source of portrait.sources)
      [source.width, source.height] = [source.height, source.width];
    expect(parseMedia(portrait)?.kind).toBe("video");
  });

  it("accepts fixtures shared with Python and keeps the entry independent of attachments", () => {
    const parsed = parseEntry(entryFixture);
    expect(parsed.attachments).toHaveLength(2);
    const broken = structuredClone(entryFixture);
    broken.media[0].manifest!.sources[0].path =
      "https://untrusted.example/orig/image";
    const safe = parseEntry(broken);
    expect(safe.record.title).toBe(entryFixture.title);
    expect(safe.attachments[0]).toEqual({
      id: imageMedia.id,
      kind: "image",
      state: "unavailable",
    });
    expect(JSON.stringify(safe.attachments)).not.toContain("untrusted");
  });
  it("never passes unapproved media metadata or private variants into rendering", () => {
    const pending = structuredClone(entryFixture.media[0]);
    pending.review_status = "pending_review";
    pending.variants = { original: "private/original" } as never;
    const attachments = parseAttachments([pending]);
    expect(attachments).toEqual([
      { id: imageMedia.id, kind: "image", state: "processing" },
    ]);
    expect(JSON.stringify(attachments)).not.toContain("/m/");
    expect(JSON.stringify(attachments)).not.toContain("private");
  });
  it("rejects unsupported versions, unreviewed captions, cross-item paths, and blank descriptions", () => {
    expect(parseMedia({ ...videoFixture, v: 2 })).toBeUndefined();
    expect(parseMedia({ ...videoFixture, captions: [] })).toBeUndefined();
    expect(
      parseMedia({ ...videoFixture, descriptive_transcript: "  " }),
    ).toBeUndefined();
    expect(
      parseMedia({
        ...videoFixture,
        captions: [{ ...videoFixture.captions[0], human_reviewed: false }],
      }),
    ).toBeUndefined();
    expect(parseMedia({ ...imageFixture, alt: "  " })).toBeUndefined();
    expect(parseMedia({ ...imageFixture, id: videoMedia.id })).toBeUndefined();
    expect(
      parseMedia({
        ...imageFixture,
        sources: [imageFixture.sources[0], imageFixture.sources[0]],
      }),
    ).toBeUndefined();
  });
  it("enforces published entry contracts, rejects negative counts, and limits media URLs", () => {
    expect(() => parseEntry({ ...entryFixture, status: "draft" })).toThrow();
    expect(() =>
      parseEntry({
        ...entryFixture,
        stats: { ...entryFixture.stats, helped_count: -1 },
      }),
    ).toThrow();
    expect(
      parseEntry({
        ...entryFixture,
        future_public_field: "new metadata",
        account_id: "private",
      }).record,
    ).not.toHaveProperty("account_id");
    expect(() => mediaUrl("javascript:alert(1)")).toThrow();
    expect(() =>
      mediaUrl(imageMedia.sources[0].path, "http://private.example"),
    ).toThrow();
    expect(
      mediaUrl(imageMedia.sources[0].path, "https://media.example.org"),
    ).toBe(`https://media.example.org${imageMedia.sources[0].path}`);
  });
  it("does not serialize full article bodies or media into discovery summaries", () => {
    const summary = summarizeEntry({
      ...examples[0],
      media: parseAttachments(entryFixture.media),
    });
    expect(summary).not.toHaveProperty("sections");
    expect(summary).not.toHaveProperty("media");
    expect(summary).not.toHaveProperty("evidence");
    expect(summary).not.toHaveProperty("context");
  });
});

describe("bandwidth and accessible rendering", () => {
  it("honors explicit reading choices before network hints", () => {
    expect(readingPolicy("full", "on", "2g")).toEqual({
      mode: "full",
      lite: false,
    });
    expect(readingPolicy("lite", null, null).lite).toBe(true);
    expect(readingPolicy(undefined, "on", null).lite).toBe(true);
    expect(readingPolicy(undefined, null, "3g").lite).toBe(true);
    expect(readingPolicy("unrecognized", null, null)).toEqual({
      mode: "auto",
      lite: false,
    });
  });
  it("renders no image, poster, caption URL or video element before lite consent, even on the server", () => {
    const html = renderToString(
      <NotebookProvider initialLite initialMode="lite">
        <MediaGallery attachments={parseAttachments(entryFixture.media)} />
      </NotebookProvider>,
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<video");
    expect(html).not.toContain("<source");
    expect(html).not.toContain("poster=");
    expect(html).not.toContain("/m/");
    expect(html).toContain("Read descriptive transcript");
    expect(html).toContain("A smaller clay pot");
  });
  it("loads only the small image after lite consent and handles its error without losing the description", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <NotebookProvider initialLite initialMode="lite">
        <ResponsiveImage media={imageMedia} />
      </NotebookProvider>,
    );
    expect(container.querySelector("img")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Load image/ }));
    const img = screen.getByRole("img", { name: imageMedia.alt });
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("width", "1600");
    expect(
      container.querySelector("source")!.getAttribute("srcset"),
    ).not.toContain("960.webp");
    fireEvent.error(img);
    expect(
      screen.getByText(
        "The image couldn’t load. Its description is still available.",
      ),
    ).toBeVisible();
    expect(screen.getByText(imageMedia.alt)).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Try the image again" }),
    );
    expect(screen.getByRole("img")).toBeInTheDocument();
  });
  it("uses native controls, reviewed caption tracks, and no video autoplay or preload", () => {
    const { container } = render(
      <NotebookProvider>
        <AccessibleVideo media={videoMedia} />
      </NotebookProvider>,
    );
    const player = container.querySelector("video")!;
    expect(player).toHaveAttribute("preload", "none");
    expect(player).toHaveAttribute("controls");
    expect(player).toHaveAttribute("playsinline");
    expect(player).not.toHaveAttribute("autoplay");
    expect(player.querySelector("track")).toHaveAttribute("kind", "captions");
    expect(player.querySelector("track")).toHaveAttribute("srclang", "en");
    expect(player.querySelector("source")).toHaveAttribute(
      "src",
      videoMedia.sources[0].path,
    );
    expect(
      screen.getByText(videoMedia.descriptive_transcript),
    ).toBeInTheDocument();
  });
  it("keeps the transcript available after playback errors", () => {
    const { container } = render(
      <NotebookProvider>
        <AccessibleVideo media={videoMedia} />
      </NotebookProvider>,
    );
    fireEvent.error(container.querySelector("video")!);
    expect(
      screen.getByText(
        "The video couldn’t load. You can still read its transcript.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(videoMedia.descriptive_transcript),
    ).toBeInTheDocument();
  });
  it("has no structural axe violations for the native media controls and transcript", async () => {
    const { container } = render(
      <NotebookProvider>
        <main>
          <h1>A media field note</h1>
          <MediaGallery attachments={parseAttachments(entryFixture.media)} />
        </main>
      </NotebookProvider>,
    );
    const result = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations.map((v) => v.id)).toEqual([]);
  });
});

describe("bounded transport", () => {
  it("rejects oversized or incorrectly typed responses before decoding", async () => {
    await expect(
      readJson(
        new Response("12345", {
          headers: {
            "content-type": "application/json",
            "content-length": "5",
          },
        }),
        4,
      ),
    ).rejects.toBeInstanceOf(PlatformUnavailable);
    await expect(
      readJson(
        new Response("<html>", { headers: { "content-type": "text/html" } }),
        100,
      ),
    ).rejects.toBeInstanceOf(PlatformUnavailable);
    await expect(
      readJson(
        new Response("{broken", {
          headers: { "content-type": "application/json" },
        }),
        100,
      ),
    ).rejects.toBeInstanceOf(PlatformUnavailable);
  });
  it("caps streamed responses without trusting Content-Length", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("123456789"));
      },
      cancel,
    });
    await expect(
      readJson(
        new Response(stream, {
          headers: { "content-type": "application/json" },
        }),
        8,
      ),
    ).rejects.toBeInstanceOf(PlatformUnavailable);
    expect(cancel).toHaveBeenCalled();
    expect(
      await readJson(
        new Response('{"ok":true}', {
          headers: { "content-type": "application/json" },
        }),
        100,
      ),
    ).toEqual({ ok: true });
  });
});
