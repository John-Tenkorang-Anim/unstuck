/**
 * A workspace is where people move from discussion to organised work on a
 * problem: ideas, tasks, tests, evidence and the decisions they made, with
 * roles. The problem page stays the public record; nothing here becomes public
 * unless its contributors publish it.
 */
export type Role = "owner" | "editor" | "contributor" | "viewer";
export const roleLabel: Record<Role, string> = {
  owner: "Owner",
  editor: "Editor",
  contributor: "Contributor",
  viewer: "Viewer",
};
export const roleHelp: Record<Role, string> = {
  owner: "Manages the workspace and who can do what",
  editor: "Creates and changes shared work",
  contributor: "Adds ideas, evidence and comments",
  viewer: "Reads what they have access to",
};
export type Visibility = "public" | "restricted" | "private";
export const visibilityLabel: Record<Visibility, string> = {
  public: "Public",
  restricted: "Restricted",
  private: "Private",
};
export type ItemKind = "idea" | "task" | "test" | "evidence" | "decision";
export const itemLabel: Record<ItemKind, string> = {
  idea: "Idea",
  task: "Task",
  test: "Test",
  evidence: "Evidence",
  decision: "Decision",
};
export const ideaColumns = [
  ["proposed", "Proposed"],
  ["review", "Under review"],
  ["ready", "Ready for testing"],
  ["evaluated", "Evaluated"],
] as const;
export const taskColumns = [
  ["todo", "To do"],
  ["doing", "In progress"],
  ["done", "Done"],
] as const;
export interface WorkspaceItem {
  id: string;
  kind: ItemKind;
  title: string;
  body: string;
  status: string;
  by: string;
  owner?: string;
  /** Task owner, when it has one. */
  assignee?: string;
  due?: string;
  /** What it relates to: a proposal, test, attempt or another item. */
  link?: { label: string; href: string };
  /** Decisions: why, who took part, the evidence, and whether it can change. */
  why?: string;
  participants?: string[];
  open?: boolean;
  created: string;
  updated: string;
}
export interface Member {
  name: string;
  role: Role;
  focus?: string;
}
export interface Workspace {
  id: string;
  title: string;
  problemId?: string;
  goal: string;
  strategy: string;
  progress: string;
  questions: string[];
  next: string[];
  visibility: Visibility;
  members: Member[];
  memberCount?: number;
  items: WorkspaceItem[];
  owner?: string;
  created: string;
  updated: string;
  sample?: boolean;
}

export const sampleWorkspaces: Workspace[] = [
  {
    id: "community-plastic-collection",
    title: "Community plastic collection improvement",
    problemId: "community-plastic-collection",
    goal: "Get two streets sorting plastic reliably enough that a collector keeps coming, and write up what made the difference.",
    strategy:
      "Test a fixed collection day with street captains before spending anything on bins or storage.",
    progress:
      "The eight-week pilot started on 13 November. Week one contamination was about 15% and 25%.",
    questions: [
      "Where do sorted bags go between pickups?",
      "Would a drop-off point at the school work better?",
    ],
    next: [
      "Photograph both streets’ bins every Wednesday evening",
      "Ask the school about a covered drop-off corner",
    ],
    visibility: "public",
    members: [
      {
        name: "green-street-19",
        role: "owner",
        focus: "Coordinating the pilot",
      },
      {
        name: "amina-k",
        role: "editor",
        focus: "Storage and drop-off options",
      },
      {
        name: "collector-joe",
        role: "contributor",
        focus: "Collection schedule",
      },
      { name: "teacher-rose", role: "viewer" },
    ],
    items: [
      {
        id: "w1",
        kind: "idea",
        title: "Fixed collection day with street captains",
        body: "Agree one pickup day and give each end of the street a named captain.",
        status: "ready",
        by: "green-street-19",
        link: {
          label: "Proposal",
          href: "/improvements/sample-improvement-recycling",
        },
        created: "2026-11-06",
        updated: "2026-11-07",
      },
      {
        id: "w2",
        kind: "idea",
        title: "Drop-off corner at the school",
        body: "A single covered point instead of bins on the street.",
        status: "review",
        by: "amina-k",
        created: "2026-11-07",
        updated: "2026-11-07",
      },
      {
        id: "w3",
        kind: "idea",
        title: "Pay captains in airtime",
        body: "A small thank-you so captains stay on.",
        status: "proposed",
        by: "collector-joe",
        created: "2026-11-08",
        updated: "2026-11-08",
      },
      {
        id: "w4",
        kind: "idea",
        title: "More bins along the street",
        body: "More capacity so bins don’t overflow.",
        status: "evaluated",
        by: "green-street-19",
        why: "Not chosen: the first attempt showed bins filled with mixed rubbish regardless of number.",
        created: "2026-11-06",
        updated: "2026-11-07",
      },
      {
        id: "w5",
        kind: "task",
        title: "Agree Thursday pickups with the collector",
        body: "",
        status: "done",
        by: "green-street-19",
        assignee: "collector-joe",
        created: "2026-11-06",
        updated: "2026-11-07",
        link: { label: "Idea", href: "#w1" },
      },
      {
        id: "w6",
        kind: "task",
        title: "Recruit two captains per street",
        body: "",
        status: "done",
        by: "green-street-19",
        assignee: "green-street-19",
        created: "2026-11-06",
        updated: "2026-11-08",
      },
      {
        id: "w7",
        kind: "task",
        title: "Weekly bin photos",
        body: "Every Wednesday evening, both streets.",
        status: "doing",
        by: "green-street-19",
        assignee: "amina-k",
        due: "2026-12-31",
        created: "2026-11-08",
        updated: "2026-11-13",
        link: { label: "Test", href: "/tests/test-recycling-fixed-day" },
      },
      {
        id: "w8",
        kind: "task",
        title: "Ask the school about a drop-off corner",
        body: "",
        status: "todo",
        by: "amina-k",
        assignee: "amina-k",
        due: "2026-11-20",
        created: "2026-11-08",
        updated: "2026-11-08",
      },
      {
        id: "w9",
        kind: "test",
        title: "Eight-week pilot on two streets",
        body: "Running since 13 November.",
        status: "running",
        by: "green-street-19",
        link: { label: "Test record", href: "/tests/test-recycling-fixed-day" },
        created: "2026-11-07",
        updated: "2026-11-13",
      },
      {
        id: "w10",
        kind: "evidence",
        title: "Week 1 bin photos",
        body: "Contamination about 15% on Mango Lane and 25% on Station Road.",
        status: "observation",
        by: "amina-k",
        link: { label: "Test", href: "/tests/test-recycling-fixed-day" },
        created: "2026-11-13",
        updated: "2026-11-13",
      },
      {
        id: "w11",
        kind: "evidence",
        title: "The original street’s experience",
        body: "Bins filled with mixed rubbish within weeks without a schedule.",
        status: "attempt",
        by: "green-street-19",
        link: {
          label: "Attempt",
          href: "/entries/community-recycling-struggled",
        },
        created: "2026-11-06",
        updated: "2026-11-06",
      },
      {
        id: "w12",
        kind: "decision",
        title: "Test the schedule before buying anything",
        body: "We will not buy more bins until the pilot ends.",
        status: "decided",
        by: "green-street-19",
        why: "More bins did nothing last time; the schedule is free to try.",
        participants: ["green-street-19", "amina-k", "collector-joe"],
        open: true,
        link: {
          label: "Evidence",
          href: "/entries/community-recycling-struggled",
        },
        created: "2026-11-07",
        updated: "2026-11-07",
      },
      {
        id: "w13",
        kind: "decision",
        title: "Pickups on Thursdays",
        body: "",
        status: "decided",
        by: "collector-joe",
        why: "The collector already serves the next estate on Tuesdays.",
        participants: ["collector-joe", "green-street-19"],
        open: false,
        created: "2026-11-07",
        updated: "2026-11-07",
      },
    ],
    created: "2026-11-06",
    updated: "2026-11-13",
    sample: true,
  },
];
