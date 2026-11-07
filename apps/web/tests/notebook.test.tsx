import { describe, it, expect } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { Discovery } from "@/components/discovery";
import { Composer } from "@/components/composer";
import { NotebookProvider } from "@/components/notebook-provider";
import { Shell } from "@/components/shell";
import { examples } from "@/lib/data";

const notebook = { entries: examples, mode: "examples" as const };
function discover(props = {}) {
  return render(
    <NotebookProvider>
      <Discovery notebook={notebook} {...props} />
    </NotebookProvider>,
  );
}

describe("finding a way forward", () => {
  it("renders useful initial content before any interaction", () => {
    discover();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Someone’s been",
    );
    expect(screen.getAllByRole("article")).toHaveLength(6);
    expect(
      screen.getByText(/Fictional stories to explore what’s possible/),
    ).toBeVisible();
  });
  it("combines search, outcome and field filters, with a working empty state", async () => {
    const user = userEvent.setup();
    discover();
    await user.type(screen.getByRole("searchbox"), "cache");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "cache",
    );
    await user.clear(screen.getByRole("searchbox"));
    await user.click(screen.getByRole("button", { name: "What worked" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /Fields/ }));
    await user.click(screen.getByRole("button", { name: "Software" }));
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(
      screen.getByRole("heading", { name: "A new direction is waiting." }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getAllByRole("article")).toHaveLength(6);
  });
  it("sorts by evidence participation and supports the search keyboard shortcut", async () => {
    const user = userEvent.setup();
    discover();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Sort entries" }),
      "tried",
    );
    expect(
      within(screen.getAllByRole("article")[0]).getByRole("heading"),
    ).toHaveTextContent("Two clay pots");
    await user.click(screen.getByRole("heading", { level: 1 }));
    await user.keyboard("/");
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });
  it("saves a note on this device and restores the notebook on a new render", async () => {
    const user = userEvent.setup();
    const view = discover();
    await user.click(
      screen.getAllByRole("button", { name: "Save to notebook" })[0],
    );
    expect(JSON.parse(localStorage.getItem("unstuck:saved")!)).toEqual([
      examples[0].id,
    ]);
    view.unmount();
    discover({ savedOnly: true });
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(1));
    await user.click(
      screen.getByRole("button", { name: "Remove from notebook" }),
    );
    expect(
      screen.getByRole("heading", {
        name: "Make room for a little inspiration.",
      }),
    ).toBeVisible();
  });
  it("shows the selected topic and questions without losing their initial state", () => {
    discover({ initialTopic: "Food & farming" });
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });
  it("does not substitute sample entries when the live API is unavailable", () => {
    render(
      <NotebookProvider>
        <Discovery notebook={{ mode: "unavailable", entries: [] }} />
      </NotebookProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "The notebook is taking a moment." }),
    ).toBeVisible();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.queryByText("A sample notebook")).not.toBeInTheDocument();
  });
  it("keeps malformed saved storage from crashing the interface", () => {
    localStorage.setItem("unstuck:saved", "invalid json");
    discover();
    expect(screen.getAllByRole("article")).toHaveLength(6);
  });
});

describe("private contribution", () => {
  it("validates, previews, saves and restores a complete field note without pretending to publish", async () => {
    const user = userEvent.setup();
    const view = render(
      <NotebookProvider>
        <Composer />
      </NotebookProvider>,
    );
    await user.click(
      screen.getByRole("button", { name: "Let’s tell the story" }),
    );
    await user.click(screen.getByRole("button", { name: "Review your note" }));
    expect(
      screen.getByLabelText("Give your note a useful title"),
    ).toHaveAttribute("aria-invalid", "true");
    await user.type(
      screen.getByLabelText("Give your note a useful title"),
      "Ventilation made a difference",
    );
    await user.type(
      screen.getByLabelText("What were you trying to do?"),
      "Keep a small harvest fresh.",
    );
    await user.type(
      screen.getByLabelText("What did you try?"),
      "Use two unglazed pots with damp sand.",
    );
    await user.type(
      screen.getByLabelText("What happened?"),
      "I am still measuring the change.",
    );
    await user.click(screen.getByRole("button", { name: "Review your note" }));
    expect(
      screen.getByRole("heading", { name: "Ventilation made a difference" }),
    ).toBeVisible();
    expect(screen.getByText("PRIVATE DRAFT")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Save finished draft" }),
    );
    expect(screen.getByText(/It has not been published/)).toBeVisible();
    expect(JSON.parse(localStorage.getItem("unstuck:draft:v1")!).title).toBe(
      "Ventilation made a difference",
    );
    view.unmount();
    render(
      <NotebookProvider>
        <Composer />
      </NotebookProvider>,
    );
    await user.click(
      screen.getByRole("button", { name: "Let’s tell the story" }),
    );
    expect(screen.getByLabelText("Give your note a useful title")).toHaveValue(
      "Ventilation made a difference",
    );
  });
  it("offers problem and idea forms without requiring an outcome", async () => {
    const user = userEvent.setup();
    render(
      <NotebookProvider>
        <Composer initialKind="problem" />
      </NotebookProvider>,
    );
    await user.click(
      screen.getByRole("button", { name: "Let’s tell the story" }),
    );
    expect(screen.getByLabelText("Where are you stuck?")).toBeVisible();
    expect(
      screen.queryByRole("group", {
        name: "How would you describe the result?",
      }),
    ).not.toBeInTheDocument();
  });
  it("does not erase a note when its storage cannot be read", async () => {
    localStorage.setItem("unstuck:draft:v1", '{"kind":"something-invalid"}');
    const user = userEvent.setup();
    render(
      <NotebookProvider>
        <Composer />
      </NotebookProvider>,
    );
    await user.click(
      screen.getByRole("button", { name: "Let’s tell the story" }),
    );
    expect(screen.getByLabelText("Give your note a useful title")).toHaveValue(
      "",
    );
  });
});

describe("accessible navigation", () => {
  it("toggles the persisted light reading mode", async () => {
    const user = userEvent.setup();
    render(
      <NotebookProvider>
        <Shell>
          <p>Content</p>
        </Shell>
      </NotebookProvider>,
    );
    await user.click(
      screen.getByRole("button", { name: "Light reading mode" }),
    );
    expect(document.documentElement.dataset.lite).toBe("true");
    expect(localStorage.getItem("unstuck:lite")).toBe("true");
  });
  it("has no structural axe violations on the discovery page", async () => {
    const { container } = render(
      <NotebookProvider>
        <Shell>
          <Discovery notebook={notebook} />
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
