import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { examples } from "@/lib/data";
import { entryDoc, search, sessionDoc, summarize, tokens } from "@/lib/search";
import { sampleSessions, sessionById } from "@/lib/sessions";
import { NotebookProvider } from "@/components/notebook-provider";
import { SessionWorkspace } from "@/components/session-workspace";

const docs = [...examples.map(entryDoc), ...sampleSessions.map(sessionDoc)];

describe("search and retrieval", () => {
  it("normalises words so plural and tense variants match", () => {
    expect(tokens("Twisting bridges failed")).toEqual([
      "twist",
      "bridg",
      "fail",
    ]);
  });
  it("lands on the exact second a video matched, not just the entry", () => {
    const { results } = search(docs, "span falls");
    expect(results[0].doc.id).toBe("tacoma-narrows-1940");
    const moment = results[0].matched.find((a) => a.kind === "moment");
    expect(moment?.href).toBe("/entries/tacoma-narrows-1940?t=116#clip");
  });
  it("finds critique sessions through their pins and feedback", () => {
    const { results } = search(docs, "cold joint");
    expect(results[0].doc.source).toBe("session");
    expect(results[0].doc.id).toBe("dull-solder-joints");
  });
  it("filters by type and field while counting every type for the tabs", () => {
    const all = search(docs, "");
    expect(all.results).toHaveLength(docs.length);
    const videos = search(docs, "", { type: "videos" });
    expect(videos.results.map((r) => r.doc.id)).toEqual([
      "tacoma-narrows-1940",
    ]);
    expect(videos.counts.critique).toBe(6);
    const software = search(docs, "", { field: "Software" });
    expect(software.results.every((r) => r.doc.field === "Software")).toBe(
      true,
    );
  });
  it("highlights matched words in the snippet and finds nothing for nonsense", () => {
    const { results } = search(docs, "humidity");
    expect(results[0].snippet.some((s) => s.hit && /humid/i.test(s.text))).toBe(
      true,
    );
    expect(search(docs, "zzqx").results).toHaveLength(0);
  });
  it("summarises outcomes and failure points as counts", () => {
    const summary = summarize(search(docs, "").results);
    expect(summary.total).toBe(examples.length);
    expect(summary.breaks[0].moment.kind).toBe("broke");
    expect(summary.outcomes.find((o) => o.key === "failed")?.count).toBe(3);
  });
});

describe("shown working", () => {
  it("lets feedback point at a single step, code line or data row", async () => {
    const user = userEvent.setup();
    render(
      <NotebookProvider>
        <SessionWorkspace session={sessionById("pendulum-g-too-high")!} />
      </NotebookProvider>,
    );
    expect(screen.getByRole("table")).toHaveTextContent("12.09");
    await user.click(screen.getByRole("button", { name: "Row 4, 1 notes" }));
    expect(screen.getByText("Notes on row 4")).toBeVisible();
    expect(document.querySelectorAll(".note")).toHaveLength(1);
    expect(document.querySelector(".note")).toHaveTextContent("9 swings");
    await user.type(screen.getByLabelText("Your note"), "Re-time this length.");
    await user.click(screen.getByRole("button", { name: "Add note" }));
    const stored = JSON.parse(
      localStorage.getItem("unstuck:session:pendulum-g-too-high")!,
    );
    expect(stored.notes[0].row).toBe(4);
  });
  it("typesets maths with a readable MathML layer and marks graded work as hints only", () => {
    render(
      <NotebookProvider>
        <SessionWorkspace session={sessionById("integration-by-parts-sign")!} />
      </NotebookProvider>,
    );
    expect(screen.getByText(/Graded work: hints only/)).toBeVisible();
    expect(document.querySelectorAll(".steps math").length).toBeGreaterThan(4);
    expect(
      screen.getByRole("button", { name: "Step 2, 1 notes" }),
    ).toBeVisible();
  });
  it("finds coursework by its code and course", () => {
    expect(search(docs, "range len window").results[0].doc.id).toBe(
      "moving-average-off-by-one",
    );
    expect(search(docs, "pendulum period").results[0].doc.id).toBe(
      "pendulum-g-too-high",
    );
  });
});

describe("feedback sessions", () => {
  it("links notes to pins, filters by kind, and keeps added notes on this device", async () => {
    const user = userEvent.setup();
    const session = sessionById("first-print-spaghetti")!;
    render(
      <NotebookProvider>
        <SessionWorkspace session={session} />
      </NotebookProvider>,
    );
    expect(
      screen
        .getAllByRole("listitem")
        .filter((li) => li.classList.contains("note")),
    ).toHaveLength(4);
    await user.click(
      screen.getByRole("button", {
        name: /^Pin 2: Where the layers start to fail/,
      }),
    );
    expect(screen.getByText("Notes on pin 2")).toBeVisible();
    expect(document.querySelectorAll(".note")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Show all notes" }));
    const filters = screen.getByRole("group", { name: "Filter feedback" });
    await user.click(within(filters).getByRole("button", { name: /Question/ }));
    expect(document.querySelectorAll(".note")).toHaveLength(1);
    await user.click(within(filters).getByRole("button", { name: /All/ }));
    await user.type(
      screen.getByLabelText("Your note"),
      "Try printing a single wall test first.",
    );
    await user.click(screen.getByRole("button", { name: "Add note" }));
    expect(document.querySelectorAll(".note")).toHaveLength(5);
    expect(
      JSON.parse(localStorage.getItem("unstuck:session:first-print-spaghetti")!)
        .notes[0].body,
    ).toBe("Try printing a single wall test first.");
  });
});
