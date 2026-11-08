/**
 * An improvement proposal is a separate, attributable contribution: what to
 * change, why it might work, what could go wrong and how to test it. It stays
 * linked to the attempt or problem it builds on, and moves through a visible
 * lifecycle. An evaluation is a verdict with nuance, never a plain yes or no.
 */
export type ImprovementStatus =
  "draft" | "discussion" | "ready" | "testing" | "evaluated";
export type Verdict = "supported" | "not_supported" | "inconclusive" | "mixed";
export const lifecycle: ImprovementStatus[] = [
  "draft",
  "discussion",
  "ready",
  "testing",
  "evaluated",
];
export const statusLabel: Record<ImprovementStatus, string> = {
  draft: "Draft",
  discussion: "Open for discussion",
  ready: "Ready for testing",
  testing: "Testing",
  evaluated: "Evaluated",
};
export const verdictLabel: Record<Verdict, string> = {
  supported: "Supported",
  not_supported: "Not supported",
  inconclusive: "Inconclusive",
  mixed: "Mixed",
};
export const verdicts = Object.keys(verdictLabel) as Verdict[];
/** Where a proposal can go next. Retesting and reopening are always possible. */
export const nextStatuses: Record<ImprovementStatus, ImprovementStatus[]> = {
  draft: ["discussion"],
  discussion: ["ready"],
  ready: ["testing", "discussion"],
  testing: ["evaluated", "ready"],
  evaluated: ["testing", "discussion"],
};
/** Words for the status, including the verdict once it has one. */
export const describeStatus = (i: Pick<Improvement, "status" | "verdict">) =>
  i.status === "evaluated" && i.verdict
    ? `Evaluated · ${verdictLabel[i.verdict]}`
    : statusLabel[i.status];
/** A colour family for the status, always shown with its words. */
export const statusTone = (i: Pick<Improvement, "status" | "verdict">) =>
  i.status === "evaluated"
    ? i.verdict === "supported"
      ? "worked"
      : i.verdict === "not_supported"
        ? "failed"
        : "mixed"
    : i.status === "draft"
      ? "quiet"
      : "ongoing";

export type EventKind =
  | "created"
  | "status"
  | "revision"
  | "question"
  | "concern"
  | "evidence"
  | "counterevidence"
  | "alternative"
  | "suggestion"
  | "comment"
  // Older kinds, kept so earlier discussion still reads correctly.
  | "challenge"
  | "refinement"
  | "test";
export const eventLabel: Record<EventKind, string> = {
  created: "Proposed",
  status: "Status",
  revision: "Revised",
  question: "Question",
  concern: "Concern",
  evidence: "Supporting evidence",
  counterevidence: "Counterevidence",
  alternative: "Alternative",
  suggestion: "Suggested change",
  comment: "Comment",
  challenge: "Concern",
  refinement: "Suggested change",
  test: "Offer to test",
};
/** What people can add to a proposal’s discussion. */
export const discussionKinds: EventKind[] = [
  "question",
  "concern",
  "evidence",
  "counterevidence",
  "alternative",
  "suggestion",
  "comment",
];
/** Questions and concerns stay visible until someone marks them answered. */
export const needsAnswer = (kind: EventKind) =>
  kind === "question" || kind === "concern" || kind === "challenge";

export interface ImprovementEvent {
  actorId?: string;
  id: string;
  kind: EventKind;
  body: string;
  actor: string;
  role: string;
  from?: ImprovementStatus | null;
  to?: ImprovementStatus | null;
  resolved?: boolean;
  created: string;
}
export interface TestPlan {
  objective: string;
  hypothesis: string;
  procedure: string;
  success: string;
  constraints: string;
  resources: string;
  risks: string;
  who: string;
}
export const planFields: [keyof TestPlan, string, string][] = [
  ["objective", "Objective", "What the test should find out"],
  ["hypothesis", "Hypothesis", "What you expect to happen, and why"],
  ["procedure", "Procedure", "What will be done, step by step"],
  [
    "success",
    "Measures of success",
    "What result would count as an improvement",
  ],
  ["constraints", "Constraints", "Time, budget, equipment or conditions"],
  ["resources", "Resources needed", "Materials, people, access"],
  ["risks", "Known risks", "What could go wrong or bias the result"],
  ["who", "Who will run it", "A person, team or open call"],
];
export const emptyPlan = (): TestPlan => ({
  objective: "",
  hypothesis: "",
  procedure: "",
  success: "",
  constraints: "",
  resources: "",
  risks: "",
  who: "",
});
export interface Improvement {
  id: string;
  /** The attempt it builds on, when there is one. */
  entryId?: string;
  problemId?: string;
  title: string;
  change: string;
  reasoning: string;
  benefit: string;
  risks: string;
  evidence: string;
  questions: string;
  plan: TestPlan;
  /** A short summary of what the tests found, in the proposer’s words. */
  results: string;
  status: ImprovementStatus;
  verdict?: Verdict | null;
  author: string;
  authorRole: string;
  owner?: string;
  created: string;
  updated: string;
  /** People who questioned, added evidence, revised or tested it. */
  collaborators: string[];
  events: ImprovementEvent[];
  sample?: boolean;
}

type Seed = Omit<
  Improvement,
  "events" | "collaborators" | "plan" | "benefit" | "risks" | "questions"
> & {
  plan?: Partial<TestPlan>;
  benefit?: string;
  risks?: string;
  questions?: string;
  collaborators?: string[];
  history?: [ImprovementStatus, string, string][];
  discussion?: [EventKind, string, string, string, boolean?][];
};
const seeds: Seed[] = [
  {
    id: "sample-improvement-biodegradation",
    entryId: "microbial-biodegradation-failed-at-scale",
    problemId: "plastic-biodegradation-scale-up",
    title: "Improve oxygen transfer during microbial scale-up",
    change:
      "Raise oxygen transfer at 10 L with finer spargers and a higher stirring rate, and halve the substrate concentration.",
    reasoning:
      "The 1 L flasks were well aerated. At 10 L, oxygen likely ran out in the middle of the vessel, which would explain growth stalling after the first week.",
    benefit: "Degradation at 10 L close to what the flasks achieved.",
    risks:
      "Faster stirring adds shear stress that could damage cells. Changing two things at once makes it harder to say which mattered.",
    evidence:
      "Across the comparison, the attempts with high oxygen transfer degraded far more plastic. Dissolved oxygen in the failed run fell below 5% by day 6.",
    questions: "Does the substrate change matter once oxygen is high?",
    plan: {
      objective:
        "Find out whether better aeration restores degradation at 10 L.",
      hypothesis:
        "With dissolved oxygen above 30%, mass loss at 10 L will be within 10 points of the 1 L result.",
      procedure:
        "Repeat the 10 L run with the same strain and film for 21 days, with finer spargers and 400 rpm stirring. Log dissolved oxygen hourly and weigh film samples weekly.",
      success: "Mass loss above 70% after 21 days.",
      constraints: "One 10 L vessel available for three weeks.",
      resources:
        "Fine spargers, a dissolved oxygen probe, a precision balance.",
      risks: "Contamination over 21 days; shear damage at higher stirring.",
      who: "bench-notes-15, with night-shift-lab-03 checking the logs",
    },
    results:
      "Mass loss rose from about 20% to about 85% at 10 L with dissolved oxygen kept above 30%.",
    status: "evaluated",
    verdict: "supported",
    author: "bench-notes-15",
    authorRole: "Microbiologist",
    created: "2026-10-20",
    updated: "2026-11-01",
    collaborators: ["night-shift-lab-03"],
    sample: true,
    history: [
      ["discussion", "bench-notes-15", "2026-10-20"],
      ["ready", "bench-notes-15", "2026-10-22"],
      ["testing", "bench-notes-15", "2026-10-23"],
      ["evaluated", "night-shift-lab-03", "2026-11-01"],
    ],
    discussion: [
      [
        "concern",
        "night-shift-lab-03",
        "Changing aeration and substrate together means we won’t know which one helped. Could one vessel keep 10 g/L?",
        "2026-10-21",
        true,
      ],
      [
        "evidence",
        "pilot-plant-08",
        "Our 50 L pilot failed with low aeration even at 5 g/L substrate, then worked when we improved aeration. That points to oxygen.",
        "2026-10-22",
      ],
      [
        "question",
        "night-shift-lab-03",
        "What dissolved oxygen level counts as ‘high’? Worth fixing a number before the run.",
        "2026-10-22",
        true,
      ],
    ],
  },
  {
    id: "sample-improvement-recycling",
    entryId: "community-recycling-struggled",
    problemId: "community-plastic-collection",
    title: "A fixed collection day with named street captains",
    change:
      "Agree one pickup day a week with the collector, and give each end of the street a named captain who checks the bins the evening before.",
    reasoning:
      "People stopped sorting when they couldn’t tell whether anyone would collect. A fixed day and a known person make the scheme visible.",
    benefit: "Cleaner bins, a collector who keeps coming, volunteers who stay.",
    risks: "Captains may burn out. A missed pickup could undo trust quickly.",
    evidence:
      "The original attempt had no schedule; contamination rose within weeks.",
    questions: "How many captains does a street of 40 homes need?",
    plan: {
      objective:
        "See whether a fixed day keeps contamination low for eight weeks.",
      hypothesis:
        "Contamination stays under 20% of bin volume with a fixed day.",
      procedure:
        "Run on two streets for eight weeks. Photograph bins the evening before pickup and estimate the share of mixed rubbish.",
      success: "Collector still coming at week eight; contamination under 20%.",
      constraints: "Volunteers only; no budget.",
      resources: "Two captains per street, a shared photo folder.",
      risks: "Rain weeks may skew photos.",
      who: "green-street-19 and two volunteers",
    },
    results: "",
    status: "testing",
    author: "green-street-19",
    authorRole: "Resident organiser",
    created: "2026-11-06",
    updated: "2026-11-07",
    collaborators: ["amina-k", "collector-joe"],
    sample: true,
    history: [
      ["discussion", "green-street-19", "2026-11-06"],
      ["ready", "green-street-19", "2026-11-06"],
      ["testing", "green-street-19", "2026-11-07"],
    ],
    discussion: [
      [
        "question",
        "collector-joe",
        "Can it be Thursdays? I do the other estate on Tuesdays.",
        "2026-11-06",
        true,
      ],
      [
        "concern",
        "amina-k",
        "Where do sorted bags go between pickups? Our street had nowhere dry to keep them.",
        "2026-11-06",
      ],
      [
        "alternative",
        "amina-k",
        "A drop-off point at the school might be easier than bins on the street.",
        "2026-11-07",
      ],
    ],
  },
  {
    id: "sample-improvement-pots",
    entryId: "two-pots-one-small-breakthrough",
    problemId: "food-spoilage-without-cold-chain",
    title: "Raise and wrap the clay-pot cooler",
    change:
      "Raise the pots on bricks and wrap the outer pot in damp jute, so air moves under and around it.",
    reasoning:
      "Evaporation needs moving, dry air. On humid days the gap between pots stayed wet but the air around it barely moved.",
    benefit: "A longer shelf life, especially in humid weeks.",
    risks: "Jute may grow mould if it never dries.",
    evidence:
      "Two readers in similar climates saw better results with airflow than with extra water.",
    questions: "Does it work in the main rainy season?",
    plan: {
      objective: "Compare a raised, wrapped cooler with the original.",
      procedure:
        "Run two coolers side by side for a week, one raised and wrapped, and weigh the same batch of tomatoes each evening.",
      success: "At least one extra day of firm tomatoes.",
      who: "dry-season-04",
    },
    results:
      "The raised cooler kept tomatoes firm two days longer in dry weeks and one day longer in humid weeks.",
    status: "evaluated",
    verdict: "supported",
    author: "breezy-tamarind-12",
    authorRole: "Farmer",
    created: "2026-10-28",
    updated: "2026-11-04",
    collaborators: ["quiet-baobab-24", "dry-season-04"],
    sample: true,
    history: [
      ["discussion", "breezy-tamarind-12", "2026-10-28"],
      ["ready", "breezy-tamarind-12", "2026-10-30"],
      ["testing", "dry-season-04", "2026-10-30"],
      ["evaluated", "breezy-tamarind-12", "2026-11-04"],
    ],
  },
  {
    id: "sample-improvement-solar",
    entryId: "low-cost-solar-coating-failed-outdoors",
    problemId: "solar-coatings-outdoors",
    title: "Cure the coating hotter and add a UV-stable binder",
    change:
      "Cure at 300 °C instead of 120 °C and add a small amount of a UV-stable siloxane binder.",
    reasoning:
      "A low cure leaves the silica network porous, so water gets in and the film cracks as it swells and dries.",
    benefit: "A coating that stays clear outdoors for at least a year.",
    risks: "Higher cure temperatures may damage panel laminates.",
    evidence: "",
    questions: "What is the highest temperature a finished panel can take?",
    status: "discussion",
    results: "",
    author: "rooftop-lab-21",
    authorRole: "Materials engineer",
    created: "2026-11-03",
    updated: "2026-11-05",
    sample: true,
    history: [["discussion", "rooftop-lab-21", "2026-11-03"]],
    discussion: [
      [
        "concern",
        "village-installer-11",
        "Most panels we install are already laminated. 300 °C will ruin the backsheet.",
        "2026-11-04",
      ],
      [
        "alternative",
        "village-installer-11",
        "Could the coating go on the cover glass before lamination instead?",
        "2026-11-05",
      ],
    ],
  },
  {
    id: "sample-improvement-delivery",
    entryId: "small-business-delivery-losses",
    problemId: "disputed-deliveries",
    title: "Photo hand-over and fixed drop-off windows",
    change:
      "Photograph every parcel at hand-over and give riders a fixed drop-off window.",
    reasoning:
      "Most losses were disputes about whether a parcel arrived, not theft.",
    benefit: "Fewer refunds and fewer arguments with customers.",
    risks: "Customers may not like fixed windows.",
    evidence: "",
    questions: "",
    plan: {
      objective: "Compare claims on routes with and without the change.",
      procedure: "Run it for one month on half the routes and compare claims.",
      success: "Claims fall by at least half.",
      who: "market-lane-02",
    },
    results: "Lost-parcel claims fell from 14 to 3 on the routes that used it.",
    status: "evaluated",
    verdict: "supported",
    author: "market-lane-02",
    authorRole: "Shop owner",
    created: "2026-10-05",
    updated: "2026-11-02",
    sample: true,
    history: [
      ["discussion", "market-lane-02", "2026-10-05"],
      ["ready", "market-lane-02", "2026-10-06"],
      ["testing", "market-lane-02", "2026-10-06"],
      ["evaluated", "market-lane-02", "2026-11-02"],
    ],
  },
  {
    id: "sample-improvement-cache",
    entryId: "the-cache-was-not-the-problem",
    problemId: "works-locally-fails-in-production",
    title: "Build cache keys from every input, and test the rule",
    change:
      "Build cache keys from every input that changes the response, including the workspace ID, and test that rule.",
    reasoning:
      "The bug came from a key that left out one input. A rule plus a test stops the same class of bug.",
    benefit: "No more cross-workspace leaks from caching.",
    risks: "Keys become longer; hit rates may drop slightly.",
    evidence: "",
    questions: "",
    plan: {
      objective: "Prove two workspaces never share a cached response.",
      procedure:
        "Add a test that renders the dashboard for two workspaces with the same filters and compares the results.",
      success: "The test fails on the old key and passes on the new one.",
      who: "patient-gecko-31",
    },
    results: "",
    status: "ready",
    author: "patient-gecko-31",
    authorRole: "Software engineer",
    created: "2026-11-02",
    updated: "2026-11-03",
    sample: true,
    history: [
      ["discussion", "patient-gecko-31", "2026-11-02"],
      ["ready", "patient-gecko-31", "2026-11-03"],
    ],
  },
  {
    id: "sample-improvement-maize",
    entryId: "maize-yellowing-after-first-rains",
    problemId: "crops-after-heavy-rain",
    title: "Drain the low rows and side-dress a test strip",
    change:
      "Dig shallow drains between the low rows and side-dress a small strip with nitrogen to compare.",
    reasoning:
      "Yellowing from the bottom up after standing water fits nitrogen loss from waterlogging.",
    benefit: "A cheap way to tell nitrogen loss from disease.",
    risks: "Weather may change before the comparison is clear.",
    evidence: "",
    questions: "How long before a difference shows?",
    plan: {
      procedure:
        "Mark three treated and three untreated rows; photograph the lowest leaves every three days.",
    },
    results: "",
    status: "discussion",
    author: "rain-gauge-07",
    authorRole: "Agronomist",
    created: "2026-11-06",
    updated: "2026-11-06",
    sample: true,
    history: [["discussion", "rain-gauge-07", "2026-11-06"]],
  },
  {
    id: "sample-improvement-tacoma",
    entryId: "tacoma-narrows-1940",
    problemId: "slender-bridges-in-wind",
    title: "A deep, open truss deck tested in a wind tunnel",
    change:
      "Replace the shallow plate-girder deck with a deep, open truss that lets wind pass through.",
    reasoning:
      "The solid, shallow deck shed vortices and could twist easily, which let aeroelastic flutter build up.",
    benefit: "A deck that resists twisting in wind.",
    risks: "",
    evidence:
      "The 1950 replacement used an open truss and stiffeners, and wind-tunnel model testing became standard.",
    questions: "",
    plan: {
      procedure: "Test section models in a wind tunnel before construction.",
    },
    results:
      "The 1950 bridge has stood since; wind-tunnel testing is now routine for long spans.",
    status: "evaluated",
    verdict: "supported",
    author: "Historical record",
    authorRole: "",
    created: "1950-10-14",
    updated: "1950-10-14",
    sample: true,
  },
];

/** Sample proposals, with a history built from their status changes. */
export const sampleImprovements: Improvement[] = seeds.map(
  ({
    history = [],
    discussion = [],
    collaborators = [],
    plan = {},
    ...seed
  }) => {
    let from: ImprovementStatus = "draft";
    const events: ImprovementEvent[] = [
      {
        id: `${seed.id}-created`,
        kind: "created" as const,
        body: seed.change,
        actor: seed.author,
        role: seed.authorRole,
        created: seed.created,
      },
      ...history.map(([to, actor, created], i) => {
        const event: ImprovementEvent = {
          id: `${seed.id}-${i}`,
          kind: "status",
          body: "",
          actor,
          role: "",
          from,
          to,
          created,
        };
        from = to;
        return event;
      }),
      ...discussion.map(
        ([kind, actor, body, created, resolved], i): ImprovementEvent => ({
          id: `${seed.id}-d${i}`,
          kind,
          actor,
          body,
          role: "",
          created,
          resolved: !!resolved,
        }),
      ),
    ].sort((a, b) => a.created.localeCompare(b.created));
    return {
      benefit: "",
      risks: "",
      questions: "",
      ...seed,
      plan: { ...emptyPlan(), ...plan },
      collaborators,
      events,
    };
  },
);
