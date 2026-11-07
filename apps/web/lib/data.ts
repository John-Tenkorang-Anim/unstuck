import type { Credit, Entry, Picture } from "./types";

const commons = (file: string) =>
  `https://commons.wikimedia.org/wiki/File:${file}`;
function picture(
  name: string,
  width: number,
  height: number,
  alt: string,
  credit: Credit,
): Picture {
  return {
    src: `/samples/${name}-1200.jpg`,
    small: `/samples/${name}-640.jpg`,
    width,
    height,
    alt,
    credit,
  };
}
export const samplePictures = {
  pots: picture(
    "pots",
    1200,
    900,
    "A large clay pot holding a smaller one, with damp sand packed between them and vegetables inside.",
    {
      author: "Peter Rinker",
      license: "CC BY-SA 3.0",
      source: commons("Tonkrugkühler,_Clay_pot_cooler,_Canari_Frigo.JPG"),
    },
  ),
  garden: picture(
    "garden",
    1200,
    900,
    "Raised vegetable beds edged with timber in a sunny garden.",
    {
      author: "Kolforn",
      license: "CC BY-SA 4.0",
      source: commons(
        "-2020-07-10_Raised_garden_beds,_Trimingham,_Norfolk.JPG",
      ),
    },
  ),
  classroom: picture(
    "classroom",
    1200,
    798,
    "Students at a classroom bench working with lemons, oranges and syringes during a science lesson.",
    {
      author: "Shixart1985",
      license: "CC BY 2.0",
      source: commons(
        "Experimenting_with_citrus_fruits_and_syringes_in_a_classroom_setting_during_a_science_lesson_undefined.jpg",
      ),
    },
  ),
  print: picture(
    "print",
    1200,
    1600,
    "A failed 3D print: the lower layers are solid, then the part collapses into a loose tangle of plastic strands.",
    {
      author: "EwkaC",
      license: "CC BY-SA 4.0",
      source: commons("Nieudany_wydruk_3D_01.jpg"),
    },
  ),
  solder: picture(
    "solder",
    1200,
    891,
    "Close-up of a circuit board where a solder joint has a dull, lumpy surface around a component lead.",
    {
      author: "Coronium",
      license: "CC BY-SA 3.0",
      source: commons("Cold_solder_joint.jpg"),
    },
  ),
  breadboard: picture(
    "breadboard",
    1200,
    1549,
    "A breadboard with a green LED, a resistor and jumper wires.",
    {
      author: "Rhetos",
      license: "CC0",
      source: commons("Steckplatine_(grüne_LED).jpg"),
    },
  ),
  tacoma: picture(
    "tacoma-still",
    1200,
    900,
    "Black and white film still of the Tacoma Narrows Bridge deck twisting between its towers.",
    {
      author: "Barney Elliott",
      license: "Public domain",
      source: commons("Tacoma_Narrows_still.png"),
    },
  ),
};

// Fictional examples demonstrate the product. They are not real research or advice.
const sampleEntries: Entry[] = [
  {
    id: "tacoma-narrows-1940",
    kind: "research",
    title: "Tacoma Narrows Bridge, 1940: why the deck twisted until it failed",
    excerpt:
      "A suspension bridge with a narrow, solid-sided deck failed four months after it opened. The film shows the deck switch from up-and-down waves to twisting in a moderate wind, then the centre span falls.",
    topic: "Making & fixing",
    outcome: "failed",
    place: "Tacoma, Washington, USA",
    alias: "archive-case-1940",
    date: "2026-11-06",
    illustration: "water",
    cover: samplePictures.tacoma,
    clip: {
      src: "/samples/tacoma-480.webm",
      type: "video/webm",
      bytes: 11100673,
      poster: samplePictures.tacoma,
      duration: 149.6,
      title: "The collapse, 7 November 1940",
      credit: {
        author: "Barney Elliott",
        license: "Public domain",
        source: commons("Tacoma_Narrows_Bridge_destruction.ogv"),
      },
      moments: [
        {
          at: 5,
          label: "The deck rolls in long vertical waves",
          kind: "note",
          detail:
            "The deck heaves up and down along its length. This motion had been seen since construction and was not what destroyed the bridge.",
        },
        {
          at: 62,
          label: "The motion changes to twisting",
          kind: "broke",
          detail:
            "Seen from the side, one edge of the deck rises while the other drops. This twisting motion is the one that grew until the span failed.",
        },
        {
          at: 70,
          label: "Looking along the deck as it twists",
          kind: "note",
          detail:
            "The roadway tilts from side to side and the lamp posts lean with it.",
        },
        {
          at: 95,
          label: "A man walks off the bridge",
          kind: "note",
          detail: "People leave the deck on foot while it is still moving.",
        },
        {
          at: 116,
          label: "The centre span tears loose and falls",
          kind: "broke",
          detail:
            "Sections of the centre span break away from the hangers and drop into the water below.",
        },
        {
          at: 136,
          label: "The aftermath",
          kind: "note",
          detail:
            "The towers and main cables still stand, with the centre span gone.",
        },
      ],
    },
    readingMinutes: 4,
    tried: 0,
    helped: 41,
    comments: 9,
    context: {
      Structure: "Suspension bridge",
      Opened: "1 July 1940",
      Failed: "7 November 1940",
      Wind: "About 40 mph",
      Deck: "Shallow solid plate girders",
    },
    sections: [
      {
        title: "What they were trying to do",
        body: "Cross the Tacoma Narrows with a long suspension bridge on a tight budget. The design used a narrow deck stiffened by shallow, solid plate girders instead of a deep open truss, which made it light and elegant.",
      },
      {
        title: "What happened",
        body: "The deck moved in the wind from the day it opened. On 7 November 1940, in a wind of about 40 mph, the motion changed from up-and-down waves to twisting. The twisting grew until the centre span broke apart and fell into the water. Nobody on the bridge was killed.",
      },
      {
        title: "Why it failed",
        body: "Investigators concluded that the slender, solid deck was aerodynamically unstable. Once it began to twist, the wind fed energy into the twisting faster than the structure could absorb it, a self-reinforcing effect now called aeroelastic flutter. It is often described as simple resonance, but that explanation is incomplete.",
      },
      {
        title: "What changed afterwards",
        body: "The replacement bridge, opened in 1950, used a deep open truss that lets wind pass through and resists twisting. Wind-tunnel testing of bridge models became standard practice.",
      },
    ],
    evidence: [
      {
        label: "Aeroelastic flutter drove the twisting failure",
        detail: "Established in the investigations that followed",
        state: "verified",
      },
      {
        label: "Simple resonance with gusts caused the collapse",
        detail: "A popular explanation that engineers consider incomplete",
        state: "proposed",
      },
    ],
    example: true,
    historical: true,
  },
  {
    id: "two-pots-one-small-breakthrough",
    kind: "solution",
    title: "Clay pot cooler kept tomatoes firm longer, except on humid days",
    excerpt:
      "I stored tomatoes in a pot-in-pot cooler with damp sand, kept in the shade. In dry weather they stayed firm longer than the comparison batch. On humid days the difference was small.",
    topic: "Food & farming",
    outcome: "worked",
    place: "Northern Ghana",
    alias: "quiet-baobab-24",
    date: "2026-11-05",
    illustration: "pots",
    cover: samplePictures.pots,
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
    title: "Dashboard cache returned data from the wrong workspace",
    excerpt:
      "Our cache key used the filter arguments but not the workspace ID, so two workspaces could share a cached result. It took about three hours to find.",
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
    title:
      "Loose chair joint: extra glue failed after a day, a refitted joint is holding",
    excerpt:
      "Adding glue to a loose joint didn’t last. Cleaning out the old glue and getting a tighter fit worked better, but it has only been in use for a few weeks.",
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
    title:
      "Same seeds in two beds grew at different rates, so I’m testing the water",
    excerpt:
      "Two beds planted on the same day with the same seed grew at different speeds. The main difference is the water source, but shade and drainage differ too.",
    topic: "Food & farming",
    outcome: "ongoing",
    place: "Nairobi, Kenya",
    alias: "curious-sunbird-32",
    date: "2026-11-02",
    illustration: "garden",
    cover: samplePictures.garden,
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
    title: "How can I keep a west-facing room cooler without using more power?",
    excerpt:
      "My small west-facing room in Accra gets hot every afternoon. I’ve tried opening windows earlier and moving furniture away from the window. Budget is under $20. What should I test next?",
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
    title:
      "Classroom intervention made no measurable difference across 12 students",
    excerpt:
      "We expected the intervention to improve a repeated measurement. Across 12 students it didn’t. This covers the method, what we recorded and the limits of a sample this small.",
    topic: "Research",
    outcome: "failed",
    place: "A community classroom",
    alias: "thoughtful-ibis-07",
    date: "2026-10-31",
    illustration: "water",
    cover: samplePictures.classroom,
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
  {
    id: "maize-yellowing-after-first-rains",
    kind: "problem",
    title:
      "Maize leaves turning yellow from the bottom up after the first rains",
    excerpt:
      "Three weeks after planting, the lower leaves on about a third of my maize went pale yellow, starting at the tips. The upper leaves still look fine. I added compost before planting but no fertiliser.",
    topic: "Food & farming",
    outcome: null,
    place: "Tamale, Ghana",
    alias: "dry-season-04",
    date: "2026-11-05",
    illustration: "garden",
    readingMinutes: 2,
    tried: 0,
    helped: 3,
    comments: 0,
    context: { Country: "Ghana", Soil: "Sandy loam", Rain: "First rains" },
    sections: [
      {
        title: "Where I am stuck",
        body: "Lower leaves are yellowing from the tip along the middle of the leaf. It is worse in the lower part of the field where water stood for a day after heavy rain.",
      },
      {
        title: "What I have already tried",
        body: "Compost before planting and weeding twice. I have not tested the soil. I am not sure whether this is nitrogen, waterlogging or something else.",
      },
      {
        title: "What would help",
        body: "How to tell the likely causes apart in the field, and what is cheap enough to test on a few rows first.",
      },
    ],
    evidence: [],
    example: true,
  },
  {
    id: "build-runs-out-of-memory-in-ci",
    kind: "problem",
    title: "Build passes on my laptop but runs out of memory in CI",
    excerpt:
      "Our Next.js build finishes in four minutes locally. On the CI runner it stops at the type-checking step with a JavaScript heap out of memory error. Nothing in the code changed between the two runs.",
    topic: "Software",
    outcome: null,
    place: "Remote team",
    alias: "quiet-compiler-19",
    date: "2026-11-04",
    illustration: "code",
    readingMinutes: 2,
    tried: 0,
    helped: 5,
    comments: 0,
    context: { Runner: "2 vCPU, 7 GB", Node: "22", Framework: "Next.js" },
    sections: [
      {
        title: "Where I am stuck",
        body: "The CI build fails with “JavaScript heap out of memory” during type checking. Locally it passes every time.",
      },
      {
        title: "What I have already tried",
        body: "Clearing the cache and re-running. Raising max-old-space-size to 4096 made it fail later instead of earlier.",
      },
      {
        title: "What would help",
        body: "Ways to find what is using the memory, or to split the work so the runner can finish.",
      },
    ],
    evidence: [],
    example: true,
  },
  {
    id: "pendulum-lab-g-too-high",
    kind: "problem",
    title: "My pendulum lab keeps giving g = 10.6 m/s². Where is the error?",
    excerpt:
      "I timed 10 swings at five string lengths and plotted T² against L. The slope gives g = 10.6 m/s² every time, about 8% too high. My method looks right to me, so I want help finding the mistake myself.",
    topic: "Research",
    outcome: null,
    place: "A school physics lab",
    alias: "first-year-22",
    date: "2026-11-03",
    illustration: "water",
    readingMinutes: 2,
    tried: 0,
    helped: 2,
    comments: 0,
    context: { Level: "Secondary school", Equipment: "Stopwatch, ruler" },
    sections: [
      {
        title: "Where I am stuck",
        body: "The value of g from my T² against L graph is consistently too high, even after repeating the measurements.",
      },
      {
        title: "What I have already tried",
        body: "Timing 10 swings instead of one, and repeating each length three times. The result barely moved.",
      },
      {
        title: "What would help",
        body: "Hints about where a consistent error could come from, not the full answer. This is for a graded report.",
      },
    ],
    evidence: [],
    example: true,
  },
];
/** Which sample communities each sample entry was posted to. */
const sampleCommunityFor: Record<string, string[]> = {
  "tacoma-narrows-1940": ["engineering-failures"],
  "two-pots-one-small-breakthrough": ["smallholder-growers"],
  "the-cache-was-not-the-problem": ["web-developers"],
  "a-chair-worth-fixing": ["fix-it-at-home"],
  "what-the-rain-changed": ["smallholder-growers"],
  "a-cooler-room-without-a-bigger-bill": ["fix-it-at-home"],
  "small-data-better-questions": ["classroom-research"],
  "maize-yellowing-after-first-rains": ["smallholder-growers"],
  "build-runs-out-of-memory-in-ci": ["web-developers"],
  "pendulum-lab-g-too-high": ["maths-and-physics-help"],
};
export const examples: Entry[] = sampleEntries.map((entry) => ({
  ...entry,
  communities: sampleCommunityFor[entry.id] ?? [],
  public: true,
}));

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
