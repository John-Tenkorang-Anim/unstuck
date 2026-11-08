/**
 * A problem is the home for a challenge: the attempts people made at it, the
 * improvements proposed, the tests run and what is still unknown. Attempts
 * point at their problem, so one record appears everywhere it is relevant.
 */
export type KnowledgeKind = "supported" | "observation" | "hypothesis";
export const knowledgeLabel: Record<KnowledgeKind, string> = {
  supported: "Supported by evidence",
  observation: "Observation",
  hypothesis: "Hypothesis",
};
export interface Known {
  kind: KnowledgeKind;
  text: string;
  /** Attempts, proposals or tests this rests on, by id. */
  refs: string[];
}
export interface Problem {
  id: string;
  title: string;
  summary: string;
  /** Category name and address; categories are open communities. */
  category: string;
  categorySlug?: string;
  subtopics?: string[];
  place?: string;
  affects: string;
  matters: string;
  constraints: string[];
  known: Known[];
  unknowns: string[];
  /** What would help most right now, in plain words. */
  needs: string[];
  /** An open question entry that first described this problem. */
  origin?: string;
  archived?: boolean;
  historical?: boolean;
  author: string;
  owner?: string;
  created: string;
  sample?: boolean;
}

/** The state of the knowledge effort, never a claim that it is solved everywhere. */
export type ProblemState = "open" | "progress" | "tested" | "archived";
export const problemStates: [ProblemState, string, string][] = [
  ["open", "Open", "Seeking experiences, evidence and ideas"],
  ["progress", "In progress", "Improvements are being discussed or tested"],
  ["tested", "Tested", "At least one approach has documented results"],
  ["archived", "Archived", "Kept for learning and reference"],
];
export const stateLabel = Object.fromEntries(
  problemStates.map(([k, l]) => [k, l]),
) as Record<ProblemState, string>;

export function problemState(
  problem: Pick<Problem, "archived">,
  work: { tests: number; testsDone: number; improvementsActive: number },
): ProblemState {
  if (problem.archived) return "archived";
  if (work.testsDone > 0) return "tested";
  if (work.improvementsActive > 0 || work.tests > 0) return "progress";
  return "open";
}

export const sampleProblems: Problem[] = [
  {
    id: "plastic-biodegradation-scale-up",
    title: "Why does microbial plastic degradation fall apart at larger scale?",
    summary:
      "A strain that breaks down plastic film well in flasks degrades far less in bigger vessels. Labs keep rediscovering this when they scale up.",
    category: "Lab experiments",
    categorySlug: "lab-experiments",
    subtopics: ["Biotechnology", "Scale-up", "Bioreactors"],
    place: "University and pilot labs",
    affects:
      "Research groups and start-ups trying to move plastic-degrading microbes from the bench to pilot plants.",
    matters:
      "Results that vanish at scale waste months of work and make promising strains look useless.",
    constraints: [
      "Pilot vessels are expensive to run for weeks",
      "Dissolved oxygen probes are not available in every lab",
      "The same strain must be used to compare fairly",
    ],
    known: [
      {
        kind: "supported",
        text: "In the attempts compared so far, every run with low oxygen transfer failed and every run with high oxygen transfer did not.",
        refs: [
          "microbial-biodegradation-failed-at-scale",
          "sample-improvement-biodegradation",
        ],
      },
      {
        kind: "observation",
        text: "Growth stalled after the first week in the failed 10 L run.",
        refs: ["microbial-biodegradation-failed-at-scale"],
      },
      {
        kind: "hypothesis",
        text: "Higher temperature may speed early growth but reduce total degradation.",
        refs: [],
      },
    ],
    unknowns: [
      "Does the oxygen effect hold above 50 L?",
      "How much does substrate concentration matter once oxygen is high?",
    ],
    needs: ["Results from 50 L or larger", "Dissolved oxygen data"],
    author: "bench-notes-15",
    created: "2026-10-19",
    sample: true,
  },
  {
    id: "community-plastic-collection",
    title:
      "How can small communities make plastic collection more sustainable?",
    summary:
      "Street and village collection schemes start with energy, then bins fill with mixed rubbish, collectors stop coming and volunteers drift away.",
    category: "Recycling & waste",
    categorySlug: "recycling-and-waste",
    subtopics: ["Volunteers", "Sorting", "Collection schedules"],
    place: "Neighbourhoods in Nairobi and Accra",
    affects:
      "Residents, informal collectors and the volunteers who keep schemes running.",
    matters:
      "Unsorted plastic has no value to collectors, so it ends up burned or in drains.",
    constraints: [
      "No budget for paid staff",
      "Collectors only come when there is enough clean, sorted plastic",
      "Bins in public places get used for everything",
    ],
    known: [
      {
        kind: "observation",
        text: "In the documented attempt, contamination rose within weeks and the collector stopped coming soon after.",
        refs: ["community-recycling-struggled"],
      },
      {
        kind: "hypothesis",
        text: "An unclear collection schedule and too little storage may be what made people give up.",
        refs: ["community-recycling-struggled", "sample-improvement-recycling"],
      },
    ],
    unknowns: [
      "Does a fixed pickup day keep volunteers involved past three months?",
      "How much storage does a street of 40 homes need?",
    ],
    needs: ["Field-test collaborators", "Experiences from other streets"],
    author: "green-street-19",
    created: "2026-11-05",
    sample: true,
  },
  {
    id: "food-spoilage-without-cold-chain",
    title: "Reducing food spoilage where there is no cold chain",
    summary:
      "Small farmers and traders lose produce between harvest and sale because refrigeration is unavailable or too expensive.",
    category: "Smallholder growers",
    categorySlug: "smallholder-growers",
    subtopics: ["Storage", "Evaporative cooling", "Transport"],
    place: "Northern Ghana and similar dry climates",
    affects: "Smallholder farmers, market traders and their customers.",
    matters:
      "Produce that spoils before sale is lost income, and in lean months it is lost food.",
    constraints: [
      "No reliable electricity",
      "Materials must be cheap and local",
      "Humidity changes a lot between seasons",
    ],
    known: [
      {
        kind: "supported",
        text: "A raised, wrapped clay-pot cooler kept tomatoes firm longer than an unwrapped one in a side-by-side week-long test.",
        refs: ["two-pots-one-small-breakthrough", "test-pots-raised"],
      },
      {
        kind: "observation",
        text: "Evaporative coolers help much less on humid days.",
        refs: ["two-pots-one-small-breakthrough"],
      },
    ],
    unknowns: [
      "What works in the humid season?",
      "Can the same idea work on a cart during transport?",
    ],
    needs: ["Measurements from humid climates", "Transport experiences"],
    author: "breezy-tamarind-12",
    created: "2026-10-28",
    sample: true,
  },
  {
    id: "solar-coatings-outdoors",
    title: "Low-cost solar coatings that survive heat, dust and humidity",
    summary:
      "Cheap anti-reflective coatings raise panel output in the lab, then cloud over or crack after a few weeks on a roof.",
    category: "Energy & materials",
    categorySlug: "energy-and-materials",
    subtopics: ["Coatings", "Durability", "Field testing"],
    place: "Hot, humid climates",
    affects: "Village installers and small solar businesses.",
    matters:
      "A coating that fails outdoors makes panels worse than doing nothing.",
    constraints: [
      "Must be applied without a clean room",
      "Must cost less than the extra power it brings",
    ],
    known: [
      {
        kind: "observation",
        text: "A silica sol coating cured at 120 °C turned cloudy and cracked within six weeks outdoors.",
        refs: ["low-cost-solar-coating-failed-outdoors"],
      },
      {
        kind: "hypothesis",
        text: "The cure temperature was too low for an outdoor coating.",
        refs: [
          "low-cost-solar-coating-failed-outdoors",
          "sample-improvement-solar",
        ],
      },
    ],
    unknowns: [
      "Which binder survives UV and humidity at low cost?",
      "How long must a coating last to pay for itself?",
    ],
    needs: ["Humidity and UV test results", "Materials expertise"],
    author: "rooftop-lab-21",
    created: "2026-11-02",
    sample: true,
  },
  {
    id: "disputed-deliveries",
    title: "Reducing lost and disputed deliveries for small businesses",
    summary:
      "Small shops refund parcels customers say never arrived, while riders say they delivered them.",
    category: "Small business",
    categorySlug: "small-business",
    subtopics: ["Logistics", "Customer service"],
    place: "Accra and other growing cities",
    affects: "Small online sellers, riders and customers.",
    matters: "Refunds on disputed parcels can wipe out a month’s margin.",
    constraints: [
      "No budget for tracking hardware",
      "Riders use their own phones",
    ],
    known: [
      {
        kind: "supported",
        text: "Photos at hand-over and a fixed drop-off window cut disputed claims from 14 to 3 a month on the routes that used them.",
        refs: ["small-business-delivery-losses", "test-delivery-photos"],
      },
      {
        kind: "observation",
        text: "Switching to a bigger courier barely changed the number of claims.",
        refs: ["small-business-delivery-losses"],
      },
    ],
    unknowns: ["Does it hold up for businesses with more than one rider?"],
    needs: ["Repeat attempts in other cities"],
    author: "market-lane-02",
    created: "2026-10-05",
    sample: true,
  },
  {
    id: "students-forget-maths",
    title: "Helping students remember maths methods after the test",
    summary:
      "Students learn a method, pass the unit test and have forgotten it by the end of term.",
    category: "Teaching maths",
    categorySlug: "teaching-maths",
    subtopics: ["Retrieval practice", "Assessment"],
    affects: "Secondary school students and their teachers.",
    matters:
      "End-of-term and national exams test everything at once, long after it was taught.",
    constraints: [
      "Lessons are already full",
      "Large classes",
      "Little marking time",
    ],
    known: [
      {
        kind: "observation",
        text: "In one class, five-minute daily quizzes on older topics did more than a longer weekly test.",
        refs: ["students-learn-maths-more-effectively"],
      },
      {
        kind: "observation",
        text: "A separate classroom intervention with 12 students showed no clear change.",
        refs: ["small-data-better-questions"],
      },
    ],
    unknowns: [
      "Does the effect hold in other schools and year groups?",
      "How much of the gain is from mixing old and new topics?",
    ],
    needs: ["Repeat attempts in other classes"],
    author: "chalk-and-talk-09",
    created: "2026-11-01",
    sample: true,
  },
  {
    id: "cool-room-without-power",
    title: "Cooling a hot room without using more electricity",
    summary:
      "West-facing rooms heat up every afternoon, and fans or air conditioning cost more than many households can pay.",
    category: "Fix it at home",
    categorySlug: "fix-it-at-home",
    subtopics: ["Shading", "Ventilation"],
    place: "Accra, Ghana",
    affects: "Households in hot climates on a tight budget.",
    matters: "Heat makes rooms hard to sleep, study and work in.",
    constraints: ["Budget under $20", "Rented home, no structural changes"],
    known: [
      {
        kind: "observation",
        text: "Opening windows earlier and moving furniture did not help noticeably.",
        refs: ["a-cooler-room-without-a-bigger-bill"],
      },
    ],
    unknowns: ["Which low-cost change makes the biggest difference?"],
    needs: ["Experiences from similar climates", "A simple way to measure"],
    origin: "a-cooler-room-without-a-bigger-bill",
    author: "warm-afternoon-33",
    created: "2026-11-01",
    sample: true,
  },
  {
    id: "crops-after-heavy-rain",
    title: "Why crops struggle after heavy rain",
    summary:
      "After heavy rain, parts of a field yellow or grow more slowly, and farmers can’t tell which cause to treat first.",
    category: "Smallholder growers",
    categorySlug: "smallholder-growers",
    subtopics: ["Drainage", "Nitrogen", "Diagnosis"],
    place: "Tamale, Ghana and Nairobi, Kenya",
    affects: "Smallholder maize and vegetable growers.",
    matters:
      "Treating the wrong cause wastes money in the weeks that matter most.",
    constraints: ["No soil lab nearby", "Fertiliser is expensive"],
    known: [
      {
        kind: "observation",
        text: "Yellowing was worse where water stood for a day.",
        refs: ["maize-yellowing-after-first-rains"],
      },
      {
        kind: "hypothesis",
        text: "Nitrogen loss from waterlogging is the likeliest cause.",
        refs: ["sample-improvement-maize"],
      },
    ],
    unknowns: ["How to tell nitrogen loss from disease in the field"],
    needs: ["Someone with a soil test kit", "Photos of similar fields"],
    origin: "maize-yellowing-after-first-rains",
    author: "rain-gauge-07",
    created: "2026-11-05",
    sample: true,
  },
  {
    id: "works-locally-fails-in-production",
    title: "Software that works on a laptop but fails in production",
    summary:
      "Builds, caches and queries behave differently once they run on shared machines with real data.",
    category: "Web developers",
    categorySlug: "web-developers",
    subtopics: ["Caching", "CI", "Memory"],
    affects: "Small software teams without a dedicated operations person.",
    matters: "These bugs hide until customers or deadlines find them.",
    constraints: ["CI runners have less memory than laptops"],
    known: [
      {
        kind: "observation",
        text: "A cache key that left out the workspace ID served one workspace’s data to another.",
        refs: ["the-cache-was-not-the-problem"],
      },
      {
        kind: "observation",
        text: "Raising the Node heap limit made a CI build fail later instead of earlier.",
        refs: ["build-runs-out-of-memory-in-ci"],
      },
    ],
    unknowns: ["What is using the memory during type checking?"],
    needs: ["Memory profiles from similar builds"],
    origin: "build-runs-out-of-memory-in-ci",
    author: "patient-gecko-31",
    created: "2026-11-04",
    sample: true,
  },
  {
    id: "pendulum-systematic-error",
    title: "Finding the systematic error in a school pendulum lab",
    summary: "A T² against L graph gives g about 8% too high, every time.",
    category: "Maths and physics help",
    categorySlug: "maths-and-physics-help",
    subtopics: ["Measurement", "Error analysis"],
    affects: "Students writing lab reports.",
    matters:
      "A consistent error points to the method, which is what the report is about.",
    constraints: ["Hints only: it’s for a graded report"],
    known: [
      {
        kind: "observation",
        text: "Timing more swings and repeating each length barely moved the result.",
        refs: ["pendulum-lab-g-too-high"],
      },
    ],
    unknowns: ["Where the length is measured to"],
    needs: ["Hints, not answers"],
    origin: "pendulum-lab-g-too-high",
    author: "lab-partner-14",
    created: "2026-11-03",
    sample: true,
  },
  {
    id: "repairs-that-last",
    title: "Making home repairs that last",
    summary:
      "Quick fixes to furniture and fittings hold for a week, then fail again.",
    category: "Fix it at home",
    categorySlug: "fix-it-at-home",
    affects: "Anyone repairing instead of replacing.",
    matters: "A repair that lasts saves money and waste.",
    constraints: ["Basic tools only"],
    known: [
      {
        kind: "observation",
        text: "More glue on a loose joint didn’t last; cleaning out the old glue and getting a tight fit did better.",
        refs: ["a-chair-worth-fixing"],
      },
    ],
    unknowns: ["Does the cleaned joint hold for a year?"],
    needs: ["Longer-term follow-ups"],
    author: "kitchen-table-05",
    created: "2026-11-03",
    sample: true,
  },
  {
    id: "slender-bridges-in-wind",
    title: "Keeping long, slender bridges stable in wind",
    summary:
      "Light, narrow decks can twist in moderate wind. The Tacoma Narrows collapse in 1940 changed how bridges are designed.",
    category: "Engineering failures",
    categorySlug: "engineering-failures",
    subtopics: ["Aerodynamics", "Suspension bridges"],
    place: "Tacoma, Washington, USA",
    affects: "Bridge engineers and everyone who crosses long spans.",
    matters: "Aeroelastic failure can bring down a bridge in minutes.",
    constraints: ["Budget pressure pushes towards slender decks"],
    known: [
      {
        kind: "supported",
        text: "Investigators found the solid, shallow deck aerodynamically unstable once it began to twist.",
        refs: ["tacoma-narrows-1940"],
      },
      {
        kind: "supported",
        text: "The 1950 replacement used a deep open truss and has stood since.",
        refs: ["sample-improvement-tacoma"],
      },
    ],
    unknowns: [],
    needs: [],
    archived: true,
    historical: true,
    author: "Historical record",
    created: "1940-11-07",
    sample: true,
  },
];

/** Which problem each sample attempt belongs to. */
export const sampleProblemFor: Record<string, string> = {
  "microbial-biodegradation-failed-at-scale": "plastic-biodegradation-scale-up",
  "community-recycling-struggled": "community-plastic-collection",
  "two-pots-one-small-breakthrough": "food-spoilage-without-cold-chain",
  "low-cost-solar-coating-failed-outdoors": "solar-coatings-outdoors",
  "small-business-delivery-losses": "disputed-deliveries",
  "students-learn-maths-more-effectively": "students-forget-maths",
  "small-data-better-questions": "students-forget-maths",
  "a-cooler-room-without-a-bigger-bill": "cool-room-without-power",
  "maize-yellowing-after-first-rains": "crops-after-heavy-rain",
  "what-the-rain-changed": "crops-after-heavy-rain",
  "the-cache-was-not-the-problem": "works-locally-fails-in-production",
  "build-runs-out-of-memory-in-ci": "works-locally-fails-in-production",
  "pendulum-lab-g-too-high": "pendulum-systematic-error",
  "a-chair-worth-fixing": "repairs-that-last",
  "tacoma-narrows-1940": "slender-bridges-in-wind",
};
