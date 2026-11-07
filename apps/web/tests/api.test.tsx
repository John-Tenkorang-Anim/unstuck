import { afterEach, describe, expect, it, vi } from "vitest";
import entryFixture from "../../../contracts/media/fixtures/entry-v1.json";
import { getEntry, getNotebook } from "@/lib/api";
import { PlatformUnavailable } from "@/lib/platform/http";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
function live() {
  vi.stubEnv("UNSTUCK_API_URL", "https://api.example.test/api/v1");
}

describe("public platform adapter", () => {
  it("distinguishes a missing entry from an outage", async () => {
    live();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({}, 404))
        .mockResolvedValueOnce(json({}, 503))
        .mockRejectedValueOnce(new Error("network")),
    );
    expect(await getEntry("missing")).toBeUndefined();
    await expect(getEntry("unavailable")).rejects.toBeInstanceOf(
      PlatformUnavailable,
    );
    await expect(getEntry("offline")).rejects.toBeInstanceOf(
      PlatformUnavailable,
    );
  });
  it("validates the serialized API entry and preserves its approved media", async () => {
    live();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(entryFixture)));
    const entry = await getEntry(entryFixture.id);
    expect(entry?.media).toHaveLength(2);
    expect(entry?.media?.[0].state).toBe("ready");
    expect(entry?.title).toBe(entryFixture.title);
    expect(entry).not.toHaveProperty("author_id");
  });
  it("keeps discovery payloads to summaries and never silently substitutes examples", async () => {
    live();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json({ items: [entryFixture] }))
        .mockResolvedValueOnce(json({}, 503)),
    );
    const notebook = await getNotebook();
    expect(notebook.mode).toBe("live");
    expect(notebook.entries).toHaveLength(1);
    expect(notebook.entries[0]).not.toHaveProperty("sections");
    expect(notebook.entries[0]).not.toHaveProperty("media");
    expect(await getNotebook()).toEqual({ entries: [], mode: "unavailable" });
  });
  it("fails closed on malformed published data", async () => {
    live();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ ...entryFixture, status: "draft" })),
    );
    await expect(getEntry(entryFixture.id)).rejects.toBeInstanceOf(
      PlatformUnavailable,
    );
  });
});
