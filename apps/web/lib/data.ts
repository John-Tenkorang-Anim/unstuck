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
export const examples: Entry[] = [
  {
    id: "tacoma-narrows-1940",
    kind: "research",
    title: "Tacoma Narrows, 1940: the bridge that twisted itself apart",
    excerpt:
      "A new suspension bridge with a slender, solid-sided deck. Moderate wind set it twisting, and four months after opening the centre span fell. Filmed from start to finish.",
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
    title: "Two clay pots. No fridge. A little more time.",
    excerpt:
      "An experiment in keeping tomatoes fresh without electricity. The surprising part? The air mattered as much as the water.",
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
