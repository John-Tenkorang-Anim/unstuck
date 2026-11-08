import { emptyPlan, type TestPlan, type Verdict } from "./improvements";

/**
 * A test evaluates a proposal or an approach, like a page in an experiment
 * notebook: the plan, each run with its conditions and deviations, results
 * against the original success criteria, and findings that say how sure we are.
 * Methodological detail is optional, so a shop owner and a lab can both use it.
 */
export type TestStatus = "planned" | "running" | "complete";
export const testStatusLabel: Record<TestStatus, string> = {
  planned: "Planned",
  running: "Running",
  complete: "Complete",
};
export interface TestRun {
  date: string;
  conditions: string;
  measurement: string;
  deviation: string;
  by: string;
}
export interface ResultRow {
  measure: string;
  criterion: string;
  observed: string;
  /** Whether the success criterion was met; null when it can’t be said. */
  met: boolean | null;
}
export interface Findings {
  happened: string;
  verdict: Verdict | null;
  confidence: "low" | "moderate" | "high";
  limitations: string;
  next: string;
}
export interface Test {
  id: string;
  title: string;
  improvementId?: string;
  entryId?: string;
  problemId?: string;
  status: TestStatus;
  plan: TestPlan;
  conditions: string[];
  runs: TestRun[];
  results: { summary: string; rows: ResultRow[] };
  findings: Findings | null;
  author: string;
  owner?: string;
  created: string;
  updated: string;
  sample?: boolean;
}
export const emptyFindings = (): Findings => ({
  happened: "",
  verdict: null,
  confidence: "low",
  limitations: "",
  next: "",
});

export const sampleTests: Test[] = [
  {
    id: "test-biodegradation-10l",
    title: "10 L run with improved aeration",
    improvementId: "sample-improvement-biodegradation",
    entryId: "microbial-biodegradation-failed-at-scale",
    problemId: "plastic-biodegradation-scale-up",
    status: "complete",
    plan: {
      ...emptyPlan(),
      objective:
        "Find out whether better aeration restores degradation at 10 L.",
      hypothesis:
        "With dissolved oxygen above 30%, mass loss will be within 10 points of the 1 L result.",
      procedure:
        "Same strain and film, 21 days, finer spargers, 400 rpm. Dissolved oxygen logged hourly; film weighed weekly.",
      success: "Mass loss above 70% after 21 days.",
      risks: "Contamination; shear damage.",
      who: "bench-notes-15",
    },
    conditions: ["Scale: 10 L", "Temperature: 30 °C", "Substrate: 5 g/L"],
    runs: [
      {
        date: "2026-10-23",
        conditions: "Day 0, dissolved oxygen 92%",
        measurement: "Film mass 2.00 g",
        deviation: "",
        by: "bench-notes-15",
      },
      {
        date: "2026-10-30",
        conditions: "Day 7, dissolved oxygen 41%",
        measurement: "Mass loss 38%",
        deviation:
          "Stirring raised to 450 rpm on day 5 when oxygen dipped to 28%",
        by: "bench-notes-15",
      },
      {
        date: "2026-11-13",
        conditions: "Day 21, dissolved oxygen 35%",
        measurement: "Mass loss 85%",
        deviation: "",
        by: "night-shift-lab-03",
      },
    ],
    results: {
      summary:
        "Degradation recovered to about 85% at 10 L, close to the 80% seen in 1 L flasks.",
      rows: [
        {
          measure: "Mass loss at 21 days",
          criterion: "Above 70%",
          observed: "85%",
          met: true,
        },
        {
          measure: "Dissolved oxygen",
          criterion: "Above 30% throughout",
          observed: "Dipped to 28% on day 5",
          met: false,
        },
        {
          measure: "Contamination",
          criterion: "None detected",
          observed: "None detected",
          met: true,
        },
      ],
    },
    findings: {
      happened:
        "With better aeration, the strain degraded about 85% of the film at 10 L.",
      verdict: "supported",
      confidence: "moderate",
      limitations:
        "One run. Aeration and substrate changed together, so the test can’t say how much each contributed.",
      next: "Repeat at 10 g/L substrate to separate the two changes.",
    },
    author: "bench-notes-15",
    created: "2026-10-22",
    updated: "2026-11-13",
    sample: true,
  },
  {
    id: "test-recycling-fixed-day",
    title: "Eight-week pilot on two streets",
    improvementId: "sample-improvement-recycling",
    entryId: "community-recycling-struggled",
    problemId: "community-plastic-collection",
    status: "running",
    plan: {
      ...emptyPlan(),
      objective:
        "See whether a fixed day keeps contamination low for eight weeks.",
      procedure:
        "Photograph bins the evening before pickup; estimate the share of mixed rubbish.",
      success: "Collector still coming at week eight; contamination under 20%.",
      who: "green-street-19",
    },
    conditions: ["Two streets, about 40 homes each", "Pickup on Thursdays"],
    runs: [
      {
        date: "2026-11-13",
        conditions: "Week 1, dry",
        measurement: "Contamination about 15% and 25%",
        deviation: "",
        by: "green-street-19",
      },
    ],
    results: { summary: "", rows: [] },
    findings: null,
    author: "green-street-19",
    created: "2026-11-07",
    updated: "2026-11-13",
    sample: true,
  },
  {
    id: "test-pots-raised",
    title: "Raised and wrapped cooler, side by side",
    improvementId: "sample-improvement-pots",
    entryId: "two-pots-one-small-breakthrough",
    problemId: "food-spoilage-without-cold-chain",
    status: "complete",
    plan: {
      ...emptyPlan(),
      objective: "Compare a raised, wrapped cooler with the original.",
      procedure: "Two coolers for a week; weigh the same batch each evening.",
      success: "At least one extra day of firm tomatoes.",
      who: "dry-season-04",
    },
    conditions: ["Dry week and humid week", "Same variety and ripeness"],
    runs: [
      {
        date: "2026-10-30",
        conditions: "Dry week",
        measurement: "+2 days firm",
        deviation: "",
        by: "dry-season-04",
      },
      {
        date: "2026-11-03",
        conditions: "Humid week",
        measurement: "+1 day firm",
        deviation: "",
        by: "dry-season-04",
      },
    ],
    results: {
      summary: "The raised cooler helped in both weeks, more in dry weather.",
      rows: [
        {
          measure: "Extra days firm, dry week",
          criterion: "At least 1",
          observed: "2",
          met: true,
        },
        {
          measure: "Extra days firm, humid week",
          criterion: "At least 1",
          observed: "1",
          met: true,
        },
      ],
    },
    findings: {
      happened: "Raising and wrapping the cooler added one to two days.",
      verdict: "supported",
      confidence: "low",
      limitations: "One household, two weeks, judged by touch.",
      next: "Repeat in the rainy season with a thermometer.",
    },
    author: "dry-season-04",
    created: "2026-10-30",
    updated: "2026-11-04",
    sample: true,
  },
  {
    id: "test-delivery-photos",
    title: "One month on half the routes",
    improvementId: "sample-improvement-delivery",
    entryId: "small-business-delivery-losses",
    problemId: "disputed-deliveries",
    status: "complete",
    plan: {
      ...emptyPlan(),
      objective: "Compare claims on routes with and without the change.",
      success: "Claims fall by at least half.",
      who: "market-lane-02",
    },
    conditions: ["Four routes changed, four unchanged", "October"],
    runs: [
      {
        date: "2026-11-01",
        conditions: "End of month",
        measurement: "3 claims on changed routes, 11 on unchanged",
        deviation: "",
        by: "market-lane-02",
      },
    ],
    results: {
      summary: "Claims fell from 14 a month to 3 on the changed routes.",
      rows: [
        {
          measure: "Claims per month",
          criterion: "Half or fewer",
          observed: "14 → 3",
          met: true,
        },
      ],
    },
    findings: {
      happened:
        "Disputed claims fell sharply on the routes that used photos and windows.",
      verdict: "supported",
      confidence: "moderate",
      limitations: "One month, one business, routes not randomised.",
      next: "Roll out to all routes and keep counting.",
    },
    author: "market-lane-02",
    created: "2026-10-06",
    updated: "2026-11-02",
    sample: true,
  },
  {
    id: "test-cache-two-workspaces",
    title: "Two workspaces, same filters",
    improvementId: "sample-improvement-cache",
    entryId: "the-cache-was-not-the-problem",
    problemId: "works-locally-fails-in-production",
    status: "planned",
    plan: {
      ...emptyPlan(),
      objective: "Prove two workspaces never share a cached response.",
      procedure:
        "Render the dashboard for two workspaces with identical filters and compare.",
      success: "Fails on the old key, passes on the new one.",
      who: "patient-gecko-31",
    },
    conditions: [],
    runs: [],
    results: { summary: "", rows: [] },
    findings: null,
    author: "patient-gecko-31",
    created: "2026-11-03",
    updated: "2026-11-03",
    sample: true,
  },
];
