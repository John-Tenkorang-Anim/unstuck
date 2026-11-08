/**
 * The Lessons Library organises knowledge derived from records. Every
 * pattern, guide and collection points back to the attempts it came from, and
 * patterns show their counterexamples and limits.
 */
export interface Pattern {
  id: string;
  title: string;
  summary: string;
  scope: string;
  /** Attempt, problem, proposal or test ids it rests on. */
  supporting: string[];
  counterexamples: { text: string; ref?: string }[];
  limitations: string;
  categories: string[];
}
export interface Guide {
  id: string;
  title: string;
  summary: string;
  /** Each step links back to real records. */
  steps: { title: string; body: string; refs: string[] }[];
  author: string;
  categories: string[];
}
export interface Collection {
  id: string;
  title: string;
  summary: string;
  items: string[];
  curator: string;
}

export const patterns: Pattern[] = [
  {
    id: "scale-up-hides-a-limit",
    title: "Scaling up exposes a limit the small version got for free",
    summary:
      "Something that works small stops working bigger because a resource the small version had in plenty becomes scarce: oxygen, airflow, memory, attention.",
    scope:
      "Lab experiments, software builds and community schemes, across four records.",
    supporting: [
      "microbial-biodegradation-failed-at-scale",
      "build-runs-out-of-memory-in-ci",
      "community-recycling-struggled",
      "sample-improvement-biodegradation",
    ],
    counterexamples: [
      {
        text: "The delivery fix worked on the first half of routes and is being rolled out without a new limit appearing so far.",
        ref: "small-business-delivery-losses",
      },
    ],
    limitations:
      "The records are from different fields; the pattern is a prompt for what to measure, not a law.",
    categories: ["Lab experiments", "Web developers", "Recycling & waste"],
  },
  {
    id: "lab-gains-vanish-outdoors",
    title: "Lab gains that vanish in the field",
    summary:
      "Improvements measured indoors disappear outdoors when heat, humidity, dust or UV weren’t part of the test.",
    scope: "Two records in energy and food storage.",
    supporting: [
      "low-cost-solar-coating-failed-outdoors",
      "two-pots-one-small-breakthrough",
    ],
    counterexamples: [],
    limitations:
      "Only two records so far. More field results would sharpen it.",
    categories: ["Energy & materials", "Smallholder growers"],
  },
  {
    id: "disputes-not-losses",
    title: "Fix the process people can see, not the supplier",
    summary:
      "Changing who does the work rarely helps when the failure is in a hand-over nobody can check. Making the step visible does.",
    scope: "Small business and community schemes.",
    supporting: [
      "small-business-delivery-losses",
      "community-recycling-struggled",
      "sample-improvement-recycling",
    ],
    counterexamples: [],
    limitations: "The recycling test is still running.",
    categories: ["Small business", "Recycling & waste"],
  },
  {
    id: "little-and-often",
    title: "Little and often beats long and rare",
    summary:
      "Short, frequent practice did more than long, infrequent sessions for remembering methods.",
    scope: "One class with a clear gain, one small study without one.",
    supporting: ["students-learn-maths-more-effectively"],
    counterexamples: [
      {
        text: "A 12-student intervention showed no clear change.",
        ref: "small-data-better-questions",
      },
    ],
    limitations: "One class. Needs repeats in other schools.",
    categories: ["Teaching maths"],
  },
];

export const guides: Guide[] = [
  {
    id: "community-recycling-pilot",
    title: "Starting a community recycling initiative",
    summary:
      "A learning path built from what other streets tried, what failed and what is being tested now.",
    author: "amina-k",
    categories: ["Recycling & waste"],
    steps: [
      {
        title: "Understand common failures",
        body: "Bins fill with mixed rubbish when nobody knows when collection happens.",
        refs: ["community-recycling-struggled"],
      },
      {
        title: "Review previous attempts",
        body: "Read what was tried, in what conditions, and what happened.",
        refs: ["community-plastic-collection"],
      },
      {
        title: "Identify operational constraints",
        body: "Collector schedules, storage between pickups, volunteer time.",
        refs: ["sample-improvement-recycling"],
      },
      {
        title: "Explore tested improvements",
        body: "A fixed day with street captains is being piloted on two streets.",
        refs: ["test-recycling-fixed-day"],
      },
      {
        title: "Plan a small pilot",
        body: "Start with one street, photograph bins weekly, decide in advance what success looks like.",
        refs: ["community-plastic-collection"],
      },
    ],
  },
  {
    id: "scaling-a-bench-result",
    title: "How to scale a bench result without losing it",
    summary:
      "Check the things a flask or laptop gives you for free before you go bigger.",
    author: "bench-notes-15",
    categories: ["Lab experiments"],
    steps: [
      {
        title: "List what the small version gets for free",
        body: "Aeration, mixing, memory, attention: write them down.",
        refs: ["microbial-biodegradation-failed-at-scale"],
      },
      {
        title: "Measure it at both scales",
        body: "Dissolved oxygen was the difference between 20% and 85%.",
        refs: ["test-biodegradation-10l"],
      },
      {
        title: "Change one thing at a time when you can",
        body: "Two changes at once leave you unsure which one helped.",
        refs: ["sample-improvement-biodegradation"],
      },
    ],
  },
];

export const collections: Collection[] = [
  {
    id: "low-cost-agriculture",
    title: "Low-cost agricultural ideas",
    summary: "Storage, drainage and diagnosis on a smallholder budget.",
    items: [
      "food-spoilage-without-cold-chain",
      "two-pots-one-small-breakthrough",
      "crops-after-heavy-rain",
      "what-the-rain-changed",
    ],
    curator: "breezy-tamarind-12",
  },
  {
    id: "field-failures",
    title: "When it worked in the lab but not outside",
    summary: "Records where conditions changed the result.",
    items: [
      "low-cost-solar-coating-failed-outdoors",
      "microbial-biodegradation-failed-at-scale",
      "tacoma-narrows-1940",
    ],
    curator: "rooftop-lab-21",
  },
  {
    id: "school-projects",
    title: "Lessons from school classrooms and labs",
    summary: "What teachers and students tried, including what didn’t move.",
    items: [
      "students-forget-maths",
      "students-learn-maths-more-effectively",
      "small-data-better-questions",
      "pendulum-lab-g-too-high",
    ],
    curator: "chalk-and-talk-09",
  },
];
