import type { Entry } from "./types";

// Fictional examples demonstrate the product. They are not real research or advice.
export const examples: Entry[] = [
  {
    id: "two-pots-one-small-breakthrough",
    kind: "solution",
    title: "Two clay pots. No fridge. A little more time.",
    excerpt:
      "An experiment in keeping tomatoes fresh without electricity. The surprising part? The air mattered as much as the water.",
    topic: "Food & farming",
    outcome: "worked",
    place: "Northern Ghana",
    alias: "quiet-baobab-24",
    date: "2026-11-05",
    illustration: "pots",
    readingMinutes: 4,
    tried: 24,
    helped: 86,
    comments: 12,
    context: {
      Country: "Ghana",
      Climate: "Hot & dry",
      Budget: "Under $20",
      Tools: "Hand tools",
    },
    sections: [
      {
        title: "What I was trying to do",
        body: "Keep a small harvest fresh for longer when reliable refrigeration was not available. I wanted to try something that used materials already close to home.",
      },
      {
        title: "What I tried",
        body: "I placed a smaller unglazed clay pot inside a larger one, filled the gap with sand, and dampened the sand. A cloth covered the inner pot. I kept both pots in a shaded, well-ventilated place and checked them each day.",
      },
      {
        title: "What happened",
        body: "In this fictional example, tomatoes in the inner pot stayed firm longer than the comparison batch. The effect was smaller on humid days. This is an illustration of how someone might document a test, not validated food-storage guidance.",
      },
      {
        title: "What I would do differently",
        body: "Measure temperature and humidity alongside the results. Compare the same variety at the same ripeness, and record which tomatoes were removed each day. Context makes the result useful to someone else.",
      },
    ],
    evidence: [
      {
        label: "Moving air may make the difference",
        detail: "Example observation · 3 supporting notes",
        state: "supported",
      },
      {
        label: "Humidity could explain the different results",
        detail: "An open question for the next experiment",
        state: "proposed",
      },
    ],
    example: true,
  },
  {
    id: "the-cache-was-not-the-problem",
    kind: "experience",
    title: "The cache wasn’t broken. Our assumption was.",
    excerpt:
      "Three hours of debugging, one missing cache key, and a lesson about testing the thing you think you know.",
    topic: "Software",
    outcome: "failed",
    place: "A small remote team",
    alias: "patient-otter-17",
    date: "2026-11-04",
    illustration: "code",
    readingMinutes: 3,
    tried: 18,
    helped: 52,
    comments: 8,
    context: {
      Environment: "Production-like staging",
      Framework: "Next.js",
      Team: "3 people",
    },
    sections: [
      {
        title: "What I was trying to do",
        body: "Make a dashboard load faster while keeping each workspace’s data separate.",
      },
      {
        title: "What I tried",
        body: "We cached a database query using the filter arguments as its key. The initial test suite covered different filters, but only one workspace.",
      },
      {
        title: "What happened",
        body: "The missing workspace identifier meant two different requests could share a key. The cache followed our instructions exactly. Our mental model was incomplete.",
      },
      {
        title: "What I learned",
        body: "Test separation boundaries, not just happy paths. We now list every dimension that can change a response before introducing caching.",
      },
    ],
    evidence: [
      {
        label: "Cache keys need every response-changing input",
        detail: "Example hypothesis · a place to add a reproduction",
        state: "proposed",
      },
    ],
    example: true,
  },
  {
    id: "a-chair-worth-fixing",
    kind: "experience",
    title: "A broken chair. A better question.",
    excerpt:
      "The first repair held for a day. The second started with understanding where the force was going.",
    topic: "Making & fixing",
    outcome: "mixed",
    place: "Kumasi, Ghana",
    alias: "steady-weaver-09",
    date: "2026-11-03",
    illustration: "chair",
    readingMinutes: 5,
    tried: 9,
    helped: 31,
    comments: 6,
    context: {
      Material: "Reclaimed wood",
      Budget: "Under $5",
      Tools: "Hand tools",
    },
    sections: [
      {
        title: "The starting point",
        body: "A dining chair had a loose joint. Replacing it felt wasteful, so I tried a small repair.",
      },
      {
        title: "Two attempts",
        body: "Adding more adhesive was the first attempt. Checking the fit and cleaning the joint changed the second attempt. This example shows why an attempt chain can be more useful than a single success story.",
      },
      {
        title: "What is still unknown",
        body: "Long-term durability needs more time and repeated use. The result remains mixed rather than declaring the repair proven.",
      },
    ],
    evidence: [
      {
        label: "Joint fit could matter more than adhesive quantity",
        detail: "Example hypothesis · needs a longer follow-up",
        state: "proposed",
      },
    ],
    example: true,
  },
  {
    id: "what-the-rain-changed",
    kind: "discovery",
    title: "Same seeds. Same soil. A different story.",
    excerpt:
      "Two garden beds became an accidental lesson in looking more closely at the water.",
    topic: "Food & farming",
    outcome: "ongoing",
    place: "Nairobi, Kenya",
    alias: "curious-sunbird-32",
    date: "2026-11-02",
    illustration: "garden",
    readingMinutes: 3,
    tried: 7,
    helped: 23,
    comments: 5,
    context: { Country: "Kenya", Setting: "Urban garden", Season: "Wet" },
    sections: [
      {
        title: "What caught my attention",
        body: "Two beds planted together seemed to grow at different speeds. The most obvious difference was their source of water.",
      },
      {
        title: "What I am measuring",
        body: "Growth, rainfall, shade, and watering frequency. It is tempting to call one factor the cause, but several things changed together.",
      },
      {
        title: "The next test",
        body: "Randomize where each water source is used and keep the other conditions as similar as possible. The outcome stays ongoing until there is more to say.",
      },
    ],
    evidence: [
      {
        label: "Water source is one possible explanation",
        detail: "Example observation · other variables remain",
        state: "proposed",
      },
    ],
    example: true,
  },
  {
    id: "a-cooler-room-without-a-bigger-bill",
    kind: "problem",
    title: "Can a room stay cooler without using more power?",
    excerpt:
      "A west-facing room, a small budget, and a few things already tried. What would you test next?",
    topic: "Everyday life",
    outcome: null,
    place: "Accra, Ghana",
    alias: "open-window-11",
    date: "2026-11-01",
    illustration: "light",
    readingMinutes: 2,
    tried: 0,
    helped: 14,
    comments: 11,
    context: { Country: "Ghana", Climate: "Hot & humid", Budget: "Under $20" },
    sections: [
      {
        title: "Where I am stuck",
        body: "A small west-facing room gets warm in the afternoon. I am looking for low-cost changes worth testing.",
      },
      {
        title: "What I have already tried",
        body: "Opening windows earlier and moving furniture away from the window. I have not measured the temperature consistently yet.",
      },
      {
        title: "What would help",
        body: "A simple way to compare options fairly, especially from someone working with a similar climate and budget.",
      },
    ],
    evidence: [
      {
        label: "Could outdoor shade make a measurable difference?",
        detail: "Open question · share a testable idea",
        state: "proposed",
      },
    ],
    example: true,
  },
  {
    id: "small-data-better-questions",
    kind: "research",
    title: "The result we didn’t expect was the one worth sharing.",
    excerpt:
      "A small classroom experiment that did not support the original hypothesis—and what it taught the group.",
    topic: "Research",
    outcome: "failed",
    place: "A community classroom",
    alias: "thoughtful-ibis-07",
    date: "2026-10-31",
    illustration: "water",
    readingMinutes: 6,
    tried: 6,
    helped: 19,
    comments: 4,
    context: {
      Setting: "Classroom",
      "Sample size": "12",
      Method: "Repeated observations",
    },
    sections: [
      {
        title: "The question",
        body: "Could a simple classroom intervention improve a repeated measurement? The original expectation seemed reasonable.",
      },
      {
        title: "Method and result",
        body: "The group collected repeated observations and found no clear change. Instead of discarding the exercise, they documented the method and its limitations.",
      },
      {
        title: "Limitations",
        body: "This fictional study is too small to draw a general conclusion. Its purpose is to show how negative results can be documented with care.",
      },
    ],
    evidence: [
      {
        label: "A null result can still inform the next experiment",
        detail: "Example research note · limitations included",
        state: "supported",
      },
    ],
    example: true,
  },
];

export const topics = [
  "Food & farming",
  "Making & fixing",
  "Software",
  "Everyday life",
  "Research",
  "Community",
] as const;
export const kindLabels = {
  experience: "Field note",
  problem: "Open question",
  solution: "A way forward",
  idea: "An idea",
  discovery: "Discovery",
  research: "Research",
};
export const outcomeLabels = {
  worked: "It worked",
  failed: "It didn’t work",
  mixed: "A mixed result",
  ongoing: "Still learning",
};
