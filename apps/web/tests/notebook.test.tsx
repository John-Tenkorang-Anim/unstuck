import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { Contribute } from "@/components/contribute";
import { branchesFor, ProgressTrail } from "@/components/knowledge";
import { NotebookProvider } from "@/components/notebook-provider";
import { Shell } from "@/components/shell";
import { sampleCommunities } from "@/lib/communities";
import { examples } from "@/lib/data";
import {
  describeStatus,
  nextStatuses,
  sampleImprovements,
} from "@/lib/improvements";
import { evidenceOf, outcomeOf } from "@/lib/outcome";
import { problemState, sampleProblems } from "@/lib/problems";
import { sampleTests } from "@/lib/tests";
import { summarizeEntry } from "@/lib/types";

const push = vi.fn();
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ push, refresh: vi.fn() }),
  usePathname: () => "/discover",
}));
beforeEach(() => {
  localStorage.clear();
  push.mockReset();
});

const problems = sampleProblems.map((p) => ({
  id: p.id,
  title: p.title,
  category: p.category,
  summary: p.summary,
}));
/** Choosing moves focus to the new heading a frame later, for screen readers. */
async function choose(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(screen.getByRole("button", { name }));
  await waitFor(() =>
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus(),
  );
}
function contribute(props: Partial<Parameters<typeof Contribute>[0]> = {}) {
  return render(
    <NotebookProvider>
      <Contribute
        problems={problems}
        proposals={[]}
        communities={sampleCommunities}
        joined={[]}
        initial={{}}
        database={false}
        {...props}
      />
    </NotebookProvider>,
  );
}

describe("contributing", () => {
  it("starts by asking what someone wants to share", () => {
    contribute();
    expect(
      screen.getByRole("heading", { name: "What would you like to share?" }),
    ).toBeVisible();
    for (const name of [
      /Something I tried/,
      /A problem I need help with/,
      /An idea for improvement/,
      /A test or result/,
    ])
      expect(screen.getByRole("button", { name })).toBeVisible();
  });
  it("guides an attempt through four stages, checking only what is required", async () => {
    const user = userEvent.setup();
    contribute();
    await choose(user, /Something I tried/);
    expect(
      screen.getByRole("heading", { name: "Share what happened." }),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: /Continue to evidence/ }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /title of at least six/,
    );
    await user.type(
      screen.getByRole("textbox", { name: /Give your experience a title/ }),
      "Our school recycling program struggled to retain volunteers",
    );
    await user.click(screen.getByRole("radio", { name: /It didn’t work/ }));
    await user.type(
      screen.getByRole("textbox", { name: /What were you trying to do/ }),
      "Keep volunteers",
    );
    await user.type(
      screen.getByRole("textbox", { name: /What happened\?/ }),
      "They left after a month",
    );
    await user.click(
      screen.getByRole("button", { name: /Continue to evidence/ }),
    );
    expect(
      screen.getByRole("heading", { name: "Show what happened." }),
    ).toBeVisible();
    expect(
      screen.getByRole("checkbox", { name: /personal account/ }),
    ).not.toBeChecked();
    await user.click(
      screen.getByRole("button", { name: /Continue to lessons/ }),
    );
    expect(
      screen.getByRole("heading", { name: "What can others learn?" }),
    ).toBeVisible();
    expect(
      screen.getByRole("checkbox", { name: /open to suggestions/ }),
    ).toBeChecked();
    await user.click(
      screen.getByRole("button", { name: /Continue to rights/ }),
    );
    expect(
      screen.getByRole("radio", { name: /not commercially/ }),
    ).toBeVisible();
    expect(
      screen.getByText(/Public doesn’t mean free for any use/),
    ).toBeVisible();
    expect(
      within(screen.getByRole("region", { name: "Preview" })).getByRole(
        "heading",
        { level: 2 },
      ),
    ).toHaveTextContent("Our school recycling program");
    // Without a database it says so instead of pretending to publish.
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  });
  it("keeps everything when switching between simple and detailed", async () => {
    const user = userEvent.setup();
    contribute();
    await choose(user, /Something I tried/);
    await user.type(
      screen.getByRole("textbox", { name: /Give your experience a title/ }),
      "Coating cracked outdoors",
    );
    await user.click(screen.getByRole("button", { name: "Detailed" }));
    expect(screen.getByRole("textbox", { name: "Condition 1" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Simple" }));
    expect(
      screen.getByRole("textbox", { name: /Give your experience a title/ }),
    ).toHaveValue("Coating cracked outdoors");
  });
  it("suggests an existing problem instead of a duplicate", async () => {
    const user = userEvent.setup();
    contribute();
    await choose(user, /A problem I need help with/);
    await user.type(
      screen.getByRole("textbox", { name: /The problem/ }),
      "Community plastic collection keeps failing in small communities",
    );
    expect(await screen.findByText("Is it one of these?")).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: /make plastic collection more sustainable/,
      }),
    ).toBeVisible();
  });
  it("restores a draft saved on this device", async () => {
    localStorage.setItem(
      "unstuck:contribute:v2",
      JSON.stringify({
        choice: "attempt",
        stage: 0,
        title: "A draft that survived",
      }),
    );
    contribute();
    expect(
      await screen.findByDisplayValue("A draft that survived"),
    ).toBeVisible();
  });
  it("keeps malformed drafts from crashing the form", () => {
    localStorage.setItem("unstuck:contribute:v2", "{nope");
    contribute();
    expect(
      screen.getByRole("heading", { name: "What would you like to share?" }),
    ).toBeVisible();
  });
});

describe("the knowledge model", () => {
  it("never calls a problem solved: only the state of the work", () => {
    expect(
      problemState({}, { tests: 0, testsDone: 0, improvementsActive: 0 }),
    ).toBe("open");
    expect(
      problemState({}, { tests: 1, testsDone: 0, improvementsActive: 1 }),
    ).toBe("progress");
    expect(
      problemState({}, { tests: 1, testsDone: 1, improvementsActive: 1 }),
    ).toBe("tested");
    expect(
      problemState(
        { archived: true },
        { tests: 1, testsDone: 1, improvementsActive: 1 },
      ),
    ).toBe("archived");
  });
  it("preserves a failed attempt’s original outcome when follow-ups improve", () => {
    const entry = examples.find(
      (e) => e.id === "microbial-biodegradation-failed-at-scale",
    )!;
    expect(outcomeOf(entry)).toBe("failed");
    expect(outcomeOf(entry, 1)).toBe("failed");
    expect(outcomeOf({ kind: "experience", outcome: "worked" })).toBe("worked");
    expect(evidenceOf(entry).label).toBe("Verified evidence");
    // Sample photos illustrate; they aren’t evidence.
    expect(
      evidenceOf(examples.find((e) => e.id === "a-chair-worth-fixing")!).level,
    ).toBe(0);
  });
  it("moves proposals through a lifecycle where verdicts need testing first", () => {
    expect(nextStatuses.draft).toEqual(["discussion"]);
    expect(nextStatuses.discussion).not.toContain("evaluated");
    expect(nextStatuses.testing).toContain("evaluated");
    expect(
      describeStatus({ status: "evaluated", verdict: "inconclusive" }),
    ).toBe("Evaluated · Inconclusive");
  });
  it("links every sample attempt, proposal and test to a real problem", () => {
    const ids = new Set(sampleProblems.map((p) => p.id));
    for (const e of examples) expect(ids.has(e.problem!)).toBe(true);
    for (const i of sampleImprovements)
      expect(ids.has(i.problemId!)).toBe(true);
    for (const t of sampleTests) expect(ids.has(t.problemId!)).toBe(true);
  });
});

describe("the progress trail", () => {
  const problem = sampleProblems.find(
    (p) => p.id === "plastic-biodegradation-scale-up",
  )!;
  const attempts = examples
    .filter((e) => e.problem === problem.id)
    .map(summarizeEntry);
  const branches = branchesFor(
    attempts,
    sampleImprovements.filter((i) => i.problemId === problem.id),
    sampleTests.filter((t) => t.problemId === problem.id),
  );
  it("connects an attempt to its proposal, test and outcome, each linking to its record", () => {
    render(<ProgressTrail problem={problem} branches={branches} />);
    const trail = screen.getByRole("list", { name: /Progress trail/ });
    expect(
      within(trail).getByRole("link", { name: /failed at scale/ }),
    ).toHaveAttribute(
      "href",
      "/entries/microbial-biodegradation-failed-at-scale",
    );
    expect(
      within(trail).getByRole("link", { name: /Improve oxygen transfer/ }),
    ).toHaveAttribute(
      "href",
      "/improvements/sample-improvement-biodegradation",
    );
    expect(
      within(trail).getByRole("link", { name: /10 L run/ }),
    ).toHaveAttribute("href", "/tests/test-biodegradation-10l");
    expect(
      within(trail).getByText("Worked under tested conditions"),
    ).toBeVisible();
  });
  it("offers the next step when a branch stops", () => {
    render(
      <ProgressTrail
        problem={problem}
        branches={[{ attempt: attempts[0], tests: [] }]}
      />,
    );
    expect(screen.getByRole("link", { name: /Propose/ })).toHaveAttribute(
      "href",
      `/improvements/new?entry=${attempts[0].id}`,
    );
  });
  it("has no structural axe violations", async () => {
    const { container } = render(
      <ProgressTrail problem={problem} branches={branches} />,
    );
    const result = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations.map((v) => `${v.id}: ${v.description}`)).toEqual(
      [],
    );
  });
});

describe("accessible navigation", () => {
  function shell(children = <p>Content</p>) {
    return render(
      <NotebookProvider>
        <Shell>{children}</Shell>
      </NotebookProvider>,
    );
  }
  it("offers four destinations and a prominent Contribute action", () => {
    shell();
    const nav = screen.getAllByRole("navigation", {
      name: "Main navigation",
    })[0];
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual(["Discover", "Problems", "Workspaces", "Lessons"]);
    expect(within(nav).getByRole("link", { name: "Discover" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getAllByRole("link", { name: /Contribute/ })[0],
    ).toHaveAttribute("href", "/new");
    const quick = screen.getByRole("navigation", { name: "Quick navigation" });
    expect(
      within(quick)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual(["Discover", "Problems", "Contribute", "Activity", "My Space"]);
  });
  it("opens search with the keyboard, finds an entry, and returns focus on close", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          entries: [
            {
              id: "the-cache-was-not-the-problem",
              title: "The cache wasn’t broken.",
              topic: "Software",
              outcome: "failed",
            },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    shell(<button>Before</button>);
    const before = screen.getByRole("button", { name: "Before" });
    before.focus();
    await user.keyboard("{Meta>}k{/Meta}");
    const input = await screen.findByRole("combobox");
    await user.type(input, "cache");
    expect(
      await screen.findByRole("option", { name: /The cache/ }),
    ).toHaveAttribute("aria-selected", "false");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(before).toHaveFocus());
    await user.keyboard("{Meta>}k{/Meta}");
    await user.type(await screen.findByRole("combobox"), "cache");
    await screen.findByRole("option", { name: /The cache/ });
    await user.keyboard("{ArrowDown}{Enter}");
    expect(push).toHaveBeenCalledWith("/entries/the-cache-was-not-the-problem");
    vi.unstubAllGlobals();
  });
  it("switches theme and remembers the choice", async () => {
    const user = userEvent.setup();
    shell();
    await user.click(screen.getByRole("button", { name: /Switch to dark/ }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("unstuck:theme")).toBe("dark");
    await user.click(screen.getByRole("button", { name: /Switch to light/ }));
    expect(document.documentElement.dataset.theme).toBe("light");
    delete document.documentElement.dataset.theme;
  });
  it("toggles the persisted light reading mode", async () => {
    const user = userEvent.setup();
    shell();
    await user.click(screen.getByRole("button", { name: /Light reading/ }));
    expect(document.documentElement.dataset.lite).toBe("true");
    expect(localStorage.getItem("unstuck:lite")).toBe("true");
  });
  it("has no structural axe violations around the contribute screen", async () => {
    const { container } = render(
      <NotebookProvider>
        <Shell>
          <Contribute
            problems={problems}
            proposals={[]}
            communities={sampleCommunities}
            joined={[]}
            initial={{}}
            database={false}
          />
        </Shell>
      </NotebookProvider>,
    );
    const result = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations.map((v) => `${v.id}: ${v.description}`)).toEqual(
      [],
    );
  });
});
