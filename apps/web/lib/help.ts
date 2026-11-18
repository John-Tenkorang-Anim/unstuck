/**
 * Help requests: someone says exactly what kind of help they need, the
 * request reaches people who have been somewhere similar, and whoever helps is
 * credited when the asker says it helped.
 */
export type HelpKind =
  | "hints"
  | "explain"
  | "review"
  | "tried"
  | "partner"
  | "expertise"
  | "equipment";
export const helpKinds: {
  key: HelpKind;
  label: string;
  ask: string;
  offer: string;
}[] = [
  {
    key: "hints",
    label: "Hints, not answers",
    ask: "Point me in the right direction so I can work it out",
    offer: "Offer a hint",
  },
  {
    key: "explain",
    label: "An explanation",
    ask: "Help me understand why this happens",
    offer: "Explain it",
  },
  {
    key: "review",
    label: "Check my work",
    ask: "Look over my method, working or code",
    offer: "Review it",
  },
  {
    key: "tried",
    label: "Someone who tried this",
    ask: "Has anyone run into exactly this?",
    offer: "Share what happened to me",
  },
  {
    key: "partner",
    label: "A test partner",
    ask: "Someone to repeat or test this with me",
    offer: "Offer to test",
  },
  {
    key: "expertise",
    label: "Expert advice",
    ask: "Someone who knows this field well",
    offer: "Offer expertise",
  },
  {
    key: "equipment",
    label: "Equipment or resources",
    ask: "Access to tools, space, materials or funding",
    offer: "Offer resources",
  },
];
export const helpLabel = Object.fromEntries(
  helpKinds.map((k) => [k.key, k.label]),
) as Record<HelpKind, string>;
export const offerLabel = Object.fromEntries(
  helpKinds.map((k) => [k.key, k.offer]),
) as Record<HelpKind, string>;

/** Who is asking shapes the defaults, never who can answer. */
export type Audience =
  "student" | "researcher" | "engineer" | "community" | "other";
export const audiences: { key: Audience; label: string; kinds: HelpKind[] }[] =
  [
    { key: "student", label: "Student", kinds: ["hints", "explain", "review"] },
    {
      key: "researcher",
      label: "Researcher",
      kinds: ["tried", "partner", "review", "expertise"],
    },
    {
      key: "engineer",
      label: "Engineer or maker",
      kinds: ["tried", "review", "expertise"],
    },
    {
      key: "community",
      label: "Community or organisation",
      kinds: ["expertise", "equipment", "tried"],
    },
    {
      key: "other",
      label: "Something else",
      kinds: ["tried", "explain", "expertise"],
    },
  ];
export const audienceLabel = Object.fromEntries(
  audiences.map((a) => [a.key, a.label]),
) as Record<Audience, string>;

export type HelpStatus = "open" | "helped" | "closed";
export const helpStatusLabel: Record<HelpStatus, string> = {
  open: "Looking for help",
  helped: "Helped",
  closed: "Closed",
};
export type OfferStatus = "offered" | "accepted" | "declined";
export interface HelpOffer {
  id: string;
  author: string;
  authorHandle?: string;
  owner?: string;
  body: string;
  status: OfferStatus;
  helped: boolean;
  created: string;
}
export interface HelpRequest {
  id: string;
  kind: HelpKind;
  audience: Audience;
  title: string;
  body: string;
  /** Graded work: helpers are asked for hints, never full answers. */
  graded: boolean;
  status: HelpStatus;
  problemId?: string;
  entryId?: string;
  category: string;
  author: string;
  authorHandle?: string;
  owner?: string;
  offers: HelpOffer[];
  /** How many people it was routed to, and why the viewer was, if they were. */
  routed: number;
  reason?: string;
  created: string;
  updated: string;
  sample?: boolean;
}

/** Why a request reached someone, in words they’ll recognise. */
export const routeReason = {
  category: "You follow this category",
  problem: "You follow this problem",
  similar: "You documented something similar",
} as const;
export type RouteReason = keyof typeof routeReason;

const offer = (
  id: string,
  author: string,
  body: string,
  created: string,
  status: OfferStatus = "offered",
  helped = false,
): HelpOffer => ({ id, author, body, status, helped, created });

export const sampleHelp: HelpRequest[] = [
  {
    id: "help-pendulum",
    kind: "hints",
    audience: "student",
    title: "Where could an 8% error in my pendulum lab come from?",
    body: "My T² against L graph gives g = 10.6 m/s² every time. I’ve repeated each length and timed ten swings. I want to find the mistake myself, so hints please.",
    graded: true,
    status: "helped",
    problemId: "pendulum-systematic-error",
    entryId: "pendulum-lab-g-too-high",
    category: "Maths and physics help",
    author: "lab-partner-14",
    offers: [
      offer(
        "o1",
        "chalk-and-talk-09",
        "Think about where the length L is measured to. Is it the point the bob swings about, all the way down?",
        "2026-11-03T15:00:00Z",
        "accepted",
        true,
      ),
      offer(
        "o2",
        "night-shift-lab-03",
        "Check whether your swings stay small. Large angles make the period longer.",
        "2026-11-03T16:10:00Z",
      ),
    ],
    routed: 14,
    created: "2026-11-03T12:00:00Z",
    updated: "2026-11-03T18:00:00Z",
    sample: true,
  },
  {
    id: "help-scale-partner",
    kind: "partner",
    audience: "researcher",
    title: "Looking for a lab to repeat our 10 L run at 50 L",
    body: "Better aeration restored degradation at 10 L, but it was one run with two changes. We need a partner with a 50 L vessel and a dissolved oxygen probe to test whether it holds.",
    graded: false,
    status: "open",
    problemId: "plastic-biodegradation-scale-up",
    category: "Lab experiments",
    author: "bench-notes-15",
    offers: [
      offer(
        "o3",
        "pilot-plant-08",
        "Our pilot plant has a 50 L vessel free in December. We can log DO hourly.",
        "2026-11-14T09:00:00Z",
        "accepted",
      ),
    ],
    routed: 9,
    created: "2026-11-13T17:00:00Z",
    updated: "2026-11-14T09:30:00Z",
    sample: true,
  },
  {
    id: "help-ci-memory",
    kind: "tried",
    audience: "engineer",
    title: "Has anyone fixed “heap out of memory” during type checking in CI?",
    body: "Locally the build passes. On the runner it fails at type checking. Raising max-old-space-size only delays the failure.",
    graded: false,
    status: "open",
    problemId: "works-locally-fails-in-production",
    entryId: "build-runs-out-of-memory-in-ci",
    category: "Web developers",
    author: "patient-gecko-31",
    offers: [],
    routed: 22,
    created: "2026-11-04T10:00:00Z",
    updated: "2026-11-04T10:00:00Z",
    sample: true,
  },
  {
    id: "help-storage",
    kind: "equipment",
    audience: "community",
    title: "A dry place to keep sorted plastic between pickups",
    body: "Two streets are piloting a fixed pickup day. Sorted bags get wet between collections. We need a covered corner for about 40 bags a week.",
    graded: false,
    status: "open",
    problemId: "community-plastic-collection",
    category: "Recycling & waste",
    author: "green-street-19",
    offers: [
      offer(
        "o4",
        "teacher-rose",
        "The school has a covered bike shelter we hardly use. I can ask the head this week.",
        "2026-11-08T13:00:00Z",
      ),
    ],
    routed: 11,
    created: "2026-11-07T19:00:00Z",
    updated: "2026-11-08T13:00:00Z",
    sample: true,
  },
];
