import { sampleProblemFor } from "./problems";
import type { Credit, Entry, Lesson, Picture } from "./types";

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
/** The landing page photograph: new growth, first light, dew. */
export const landingPicture: Picture = {
  src: "/landing/morning-seedlings-1920.jpg",
  small: "/landing/morning-seedlings-960.jpg",
  width: 1920,
  height: 1074,
  alt: "Young rice seedlings beaded with dew on a misty morning, with the sun low over the field.",
  credit: {
    author: "Aqsis Bey",
    license: "CC BY-SA 4.0",
    source: commons(
      "The_Rice_Seedlings_are_Wet_with_Dew_in_a_Winter_Morning.jpg",
    ),
  },
};
/**
 * The work shared in sample critique sessions. Reviewers' pins sit at exact
 * spots on these photos, so they stay with the sessions.
 */
export const sessionPictures = {
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
};
export const samplePictures = {
  tacoma: picture(
    "tacoma",
    1200,
    794,
    "Looking up at a suspension bridge tower, its main cables running against a clear blue sky.",
    {
      author: "mattbuck",
      license: "CC BY-SA 3.0",
      source: commons("Bristol_MMB_\u00abB8_Clifton_Suspension_Bridge.jpg"),
    },
  ),
  pots: picture(
    "pots",
    1200,
    900,
    "Ripe red cherry tomatoes on the vine, piled high at a market stall.",
    {
      author: "Grendelkhan",
      license: "CC BY-SA 3.0",
      source: commons("Cocktail_tomatoes_at_Campbell_farmer's_market.jpg"),
    },
  ),
  cache: picture(
    "cache",
    1200,
    869,
    "Hands typing on a laptop showing lines of code, on a pale wooden desk.",
    {
      author: "Crew crew",
      license: "CC0",
      source: commons("Programmer_at_work_(Unsplash).jpg"),
    },
  ),
  chair: picture(
    "chair",
    1200,
    802,
    "A chisel, two angle gauges and a carpenter's pencil laid out on a white surface.",
    {
      author: "CEphoto, Uwe Aranas",
      license: "CC BY-SA 3.0",
      source: commons(
        "Carpenter-tools_Beveled-edge-chisel-two-angle-gauges-and-carpenters-pencil-01.jpg",
      ),
    },
  ),
  seeds: picture(
    "seeds",
    1200,
    901,
    "Garden beds with young plants in front of a small wooden shed.",
    {
      author: "Touam (Hervé Agnoux)",
      license: "CC BY-SA 4.0",
      source: commons("Cabane_de_jardin_et_crassier_de_l'\u00c9pare.jpg"),
    },
  ),
  room: picture(
    "room",
    1200,
    785,
    "A white window with red wooden shutters on a dark timber wall.",
    {
      author: "Radomianin",
      license: "CC BY-SA 4.0",
      source: commons("Fischerkirche_(window),_Born_a._Dar\u00df.jpg"),
    },
  ),
  classroom: picture(
    "classroom",
    1200,
    797,
    "An old lecture room with wooden benches facing a long chalkboard.",
    {
      author: "Marie-Lan Nguyen",
      license: "CC BY 2.5",
      source: commons("Grande_salle_ENC_n1.jpg"),
    },
  ),
  maize: picture(
    "maize",
    1200,
    800,
    "Tall green maize plants filling a field.",
    {
      author: "John Samuel",
      license: "CC BY-SA 4.0",
      source: commons("Field_in_Dr\u00f4me_01.jpg"),
    },
  ),
  build: picture(
    "build",
    1200,
    801,
    "A long, bright corridor of white server racks in a data centre.",
    {
      author: "PiDatacenters",
      license: "CC BY-SA 4.0",
      source: commons("Racks_Amravati_Data_Center.jpg"),
    },
  ),
  pendulum: picture(
    "pendulum",
    1200,
    675,
    "Flasks of pink and blue liquid on a laboratory bench.",
    {
      author: "ElNokko",
      license: "CC BY-SA 4.0",
      source: commons("Analytics.jpg"),
    },
  ),
  solar: picture(
    "solar",
    1200,
    800,
    "A house with solar panels on its roof, below green hills.",
    {
      author: "Mike Peel",
      license: "CC BY-SA 4.0",
      source: commons("At_Paraty_2023_441.jpg"),
    },
  ),
  delivery: picture(
    "delivery",
    1200,
    900,
    "A red parcel locker standing in a residential courtyard.",
    {
      author: "Nikolai Bulykin",
      license: "CC BY-SA 4.0",
      source: commons(
        "\u0410\u043b\u043c\u0430\u0442\u044b,_\u043f\u043e\u0441\u0442\u043e\u043c\u0430\u0442_\u0432\u043e_\u0434\u0432\u043e\u0440\u0435_\u0422\u043e\u043b\u0435_\u0431\u0438_64_(1).jpg",
      ),
    },
  ),
  recycling: picture(
    "recycling",
    1200,
    834,
    "Green, blue and yellow recycling bins for glass, paper and plastic.",
    {
      author: "Jacek Halicki",
      license: "CC BY-SA 4.0",
      source: commons("2017_Pojemniki_na_\u015bmieci_w_Smreczynie.jpg"),
    },
  ),
  maths: picture(
    "maths",
    1200,
    861,
    "A green chalkboard with a large protractor in a bright classroom.",
    {
      author: "PantheraLeo1359531",
      license: "CC BY 4.0",
      source: commons(
        "JCRG_\u2013_Klassenzimmer_20240830_HOF0294_RAW-Export.jpg",
      ),
    },
  ),
  lab: picture(
    "lab",
    1200,
    800,
    "Bottles of brightly coloured reagents on a laboratory shelf.",
    {
      author: "Robert Kowalewski",
      license: "CC BY-SA 4.0",
      source: commons(
        "Laboratorium_chemiczne,_Centrum_Nauki_Kopernik._fot._Robert_Kowalewski.jpg",
      ),
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
    topic: "Engineering",
    outcome: "failed",
    place: "Tacoma, Washington, USA",
    alias: "archive-case-1940",
    date: "2026-11-06",
    illustration: "water",
    cover: samplePictures.tacoma,
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
    topic: "Agriculture",
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
    topic: "Technology",
    outcome: "failed",
    place: "A small remote team",
    alias: "patient-otter-17",
    date: "2026-11-04",
    illustration: "code",
    cover: samplePictures.cache,
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
    topic: "Everyday life",
    outcome: "mixed",
    place: "Kumasi, Ghana",
    alias: "steady-weaver-09",
    date: "2026-11-03",
    illustration: "chair",
    cover: samplePictures.chair,
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
    topic: "Agriculture",
    outcome: "ongoing",
    place: "Nairobi, Kenya",
    alias: "curious-sunbird-32",
    date: "2026-11-02",
    illustration: "garden",
    cover: samplePictures.seeds,
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
    cover: samplePictures.room,
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
    topic: "Education",
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
    topic: "Agriculture",
    outcome: null,
    place: "Tamale, Ghana",
    alias: "dry-season-04",
    date: "2026-11-05",
    illustration: "garden",
    cover: samplePictures.maize,
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
    topic: "Technology",
    outcome: null,
    place: "Remote team",
    alias: "quiet-compiler-19",
    date: "2026-11-04",
    illustration: "code",
    cover: samplePictures.build,
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
    topic: "Education",
    outcome: null,
    place: "A school physics lab",
    alias: "first-year-22",
    date: "2026-11-03",
    illustration: "water",
    cover: samplePictures.pendulum,
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
  {
    id: "low-cost-solar-coating-failed-outdoors",
    kind: "experience",
    title: "Why our low-cost solar coating failed outdoors",
    excerpt:
      "A cheap anti-reflective coating raised panel output by 4% in the lab. After six weeks on a roof it was cloudy, and output was lower than an uncoated panel.",
    topic: "Energy & materials",
    outcome: "failed",
    place: "Kumasi, Ghana",
    alias: "sunny-workbench-09",
    date: "2026-11-02",
    illustration: "light",
    cover: samplePictures.solar,
    readingMinutes: 3,
    tried: 3,
    helped: 21,
    comments: 7,
    context: { Climate: "Hot & humid", Exposure: "6 weeks", Budget: "Low" },
    sections: [
      {
        title: "The problem",
        body: "Dust and reflection cost small solar panels output. We wanted a coating cheap enough for village installers.",
      },
      {
        title: "The attempt",
        body: "We dip-coated panels in a silica sol and cured them at 120 °C. Indoors, output rose by about 4%.",
      },
      {
        title: "The outcome",
        body: "After six weeks outdoors the coating turned cloudy and cracked along the edges. Coated panels produced about 3% less than uncoated ones.",
      },
      {
        title: "Key lessons",
        body: "Lab gains mean little without humidity and UV testing. Cure temperature was likely too low for an outdoor coating.",
      },
    ],
    evidence: [
      {
        label: "Humidity broke down the under-cured coating",
        detail: "Proposed · consistent with the cloudy edges",
        state: "proposed",
      },
    ],
    example: true,
  },
  {
    id: "small-business-delivery-losses",
    kind: "solution",
    title: "How a small business reduced delivery losses",
    excerpt:
      "We were losing about 14 parcels a month to disputed deliveries. Photographing every hand-over and fixing drop-off windows cut that to 3.",
    topic: "Small business",
    outcome: "worked",
    place: "Accra, Ghana",
    alias: "market-lane-02",
    date: "2026-11-02",
    illustration: "code",
    cover: samplePictures.delivery,
    readingMinutes: 2,
    tried: 9,
    helped: 33,
    comments: 5,
    context: { Business: "Online shop", Riders: "4", Orders: "≈600 a month" },
    sections: [
      {
        title: "The problem",
        body: "Customers said parcels never arrived; riders said they had delivered them. We refunded most claims.",
      },
      {
        title: "The attempt",
        body: "First we switched to a bigger courier. Claims barely changed, so we looked at the hand-over itself.",
      },
      {
        title: "The outcome",
        body: "Photos at hand-over and a fixed two-hour window cut claims from 14 to 3 a month on the routes that used them.",
      },
      {
        title: "Key lessons",
        body: "Most losses were disputes, not theft. Changing the courier did not touch the real cause.",
      },
    ],
    evidence: [],
    example: true,
  },
  {
    id: "community-recycling-struggled",
    kind: "experience",
    title: "Why a community recycling initiative struggled",
    excerpt:
      "Our street started sorting plastic for a collector. Within two months bins were full of mixed rubbish and the collector stopped coming. How do we restart it?",
    topic: "Recycling & waste",
    outcome: "failed",
    place: "Nairobi, Kenya",
    alias: "corner-shop-18",
    date: "2026-11-05",
    illustration: "water",
    cover: samplePictures.recycling,
    readingMinutes: 2,
    tried: 0,
    helped: 6,
    comments: 0,
    context: { Households: "≈40", Collector: "Weekly, then stopped" },
    sections: [
      {
        title: "The problem",
        body: "Sorted plastic is worth money to the collector, but only if it is clean and sorted.",
      },
      {
        title: "The attempt",
        body: "We put labelled bins at both ends of the street and explained it at a residents' meeting.",
      },
      {
        title: "The outcome",
        body: "The bins filled with mixed rubbish within weeks, the collector stopped coming, and people lost interest.",
      },
    ],
    evidence: [],
    example: true,
  },
  {
    id: "students-learn-maths-more-effectively",
    kind: "experience",
    title: "What helped our students learn mathematics more effectively",
    excerpt:
      "Short daily retrieval quizzes did more for our Form 2 class than longer weekly tests. Scores on the end-of-term paper rose for most students.",
    topic: "Teaching maths",
    outcome: "worked",
    place: "A secondary school in Tamale",
    alias: "chalk-and-board-11",
    date: "2026-11-01",
    illustration: "water",
    cover: samplePictures.maths,
    readingMinutes: 3,
    tried: 14,
    helped: 41,
    comments: 9,
    context: { Students: "38", Level: "Form 2", Length: "One term" },
    sections: [
      {
        title: "The problem",
        body: "Students forgot methods a few weeks after learning them, so the end-of-term paper went badly.",
      },
      {
        title: "The attempt",
        body: "We first tried a longer weekly test. It took a lesson every week and did not help. Then we switched to five-minute daily quizzes on older topics.",
      },
      {
        title: "The outcome",
        body: "The median end-of-term score rose from 48% to 61%. It is one class, so we want others to try it.",
      },
      {
        title: "Key lessons",
        body: "Little and often beat long and rare. Quizzes worked best when they mixed old topics with new ones.",
      },
    ],
    evidence: [
      {
        label: "Spaced retrieval explains most of the gain",
        detail: "Supported · matches published findings",
        state: "supported",
      },
    ],
    example: true,
  },
  {
    id: "microbial-biodegradation-failed-at-scale",
    kind: "research",
    title: "Our microbial biodegradation test failed at scale",
    excerpt:
      "A bacterial strain broke down about 80% of a plastic film in 1 L flasks. In a 10 L vessel it managed about 20%, with the same strain and the same time.",
    topic: "Lab experiments",
    outcome: "failed",
    place: "A university lab",
    alias: "bench-notes-15",
    date: "2026-10-19",
    illustration: "water",
    cover: samplePictures.lab,
    readingMinutes: 4,
    tried: 5,
    helped: 27,
    comments: 6,
    context: {
      Scale: "10 L",
      "Oxygen transfer": "Low",
      "Substrate concentration": "10 g/L",
      Duration: "21 days",
    },
    sections: [
      {
        title: "The problem",
        body: "We wanted to know whether a strain that degraded plastic film in flasks would hold up at a larger scale.",
      },
      {
        title: "The attempt",
        body: "We moved from 1 L shaken flasks to a 10 L stirred vessel, keeping the strain, film and time the same.",
      },
      {
        title: "The outcome",
        body: "Mass loss fell from about 80% to about 20%. Growth stalled after the first week.",
      },
      {
        title: "Key lessons",
        body: "Measure dissolved oxygen when scaling up. What a flask gives you for free, a larger vessel may not.",
      },
    ],
    evidence: [
      {
        label: "Oxygen ran short in the larger vessel",
        detail: "Verified · dissolved oxygen fell below 5% by day 6",
        state: "verified",
      },
    ],
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
  "low-cost-solar-coating-failed-outdoors": ["energy-and-materials"],
  "small-business-delivery-losses": ["small-business"],
  "community-recycling-struggled": ["recycling-and-waste"],
  "students-learn-maths-more-effectively": ["teaching-maths"],
  "microbial-biodegradation-failed-at-scale": ["lab-experiments"],
};
/** Lessons from each sample attempt, labelled by what kind of claim they are. */
const sampleLessons: Record<string, Lesson[]> = {
  "tacoma-narrows-1940": [
    {
      kind: "observation",
      text: "The deck moved in wind from the day it opened, then switched from waves to twisting.",
    },
    {
      kind: "interpretation",
      text: "Once twisting began, the wind fed energy in faster than the structure could shed it.",
    },
    {
      kind: "recommendation",
      text: "Test models of slender structures in a wind tunnel before building them.",
    },
  ],
  "two-pots-one-small-breakthrough": [
    {
      kind: "observation",
      text: "Tomatoes stayed firm longer in the cooler, but the gain was small on humid days.",
    },
    {
      kind: "interpretation",
      text: "Evaporation needs dry, moving air, so humidity limits any evaporative cooler.",
    },
    {
      kind: "recommendation",
      text: "Record temperature and humidity alongside results so others can judge if it fits their climate.",
    },
  ],
  "the-cache-was-not-the-problem": [
    {
      kind: "observation",
      text: "Two workspaces could share a cached result because the key left out the workspace ID.",
    },
    {
      kind: "recommendation",
      text: "List every input that can change a response before caching it, and test across those boundaries.",
    },
  ],
  "a-chair-worth-fixing": [
    {
      kind: "observation",
      text: "Extra glue on a loose joint didn’t hold; a cleaned joint with a tight fit did better.",
    },
    { kind: "recommendation", text: "Clean out old adhesive before regluing." },
  ],
  "what-the-rain-changed": [
    {
      kind: "observation",
      text: "Two beds planted the same day grew at different speeds.",
    },
    {
      kind: "interpretation",
      text: "Water source, shade and drainage all differed, so no single cause can be named yet.",
    },
    {
      kind: "recommendation",
      text: "Randomise which bed gets which water before drawing conclusions.",
    },
  ],
  "small-data-better-questions": [
    {
      kind: "observation",
      text: "Across 12 students the intervention showed no clear change.",
    },
    {
      kind: "recommendation",
      text: "Document small negative results with their limits instead of discarding them.",
    },
  ],
  "low-cost-solar-coating-failed-outdoors": [
    {
      kind: "observation",
      text: "Output rose 4% indoors but fell 3% below uncoated panels after six weeks outdoors.",
    },
    {
      kind: "interpretation",
      text: "A 120 °C cure was likely too low for a coating exposed to UV and humidity.",
    },
    {
      kind: "recommendation",
      text: "Run humidity and UV ageing tests before trusting lab gains.",
    },
  ],
  "small-business-delivery-losses": [
    {
      kind: "observation",
      text: "Changing to a bigger courier barely changed the number of claims.",
    },
    {
      kind: "interpretation",
      text: "Most losses were disputes about hand-over, not theft.",
    },
    {
      kind: "recommendation",
      text: "Photograph every hand-over and agree a fixed drop-off window.",
    },
  ],
  "community-recycling-struggled": [
    {
      kind: "observation",
      text: "Bins filled with mixed rubbish within weeks, and the collector stopped coming.",
    },
    {
      kind: "interpretation",
      text: "People didn’t know when collection happened, so sorting felt pointless.",
    },
    {
      kind: "recommendation",
      text: "Agree a collection day with the collector before putting out bins.",
    },
  ],
  "students-learn-maths-more-effectively": [
    {
      kind: "observation",
      text: "The median end-of-term score rose from 48% to 61% in one class.",
    },
    {
      kind: "interpretation",
      text: "Frequent retrieval of older topics helped methods stick.",
    },
    {
      kind: "recommendation",
      text: "Use short daily quizzes that mix old and new topics.",
    },
  ],
  "microbial-biodegradation-failed-at-scale": [
    {
      kind: "observation",
      text: "Degradation fell from about 80% in 1 L flasks to about 20% at 10 L.",
    },
    {
      kind: "interpretation",
      text: "Reduced oxygen transfer in the larger vessel likely limited growth.",
    },
    {
      kind: "recommendation",
      text: "Measure oxygen transfer before increasing scale.",
    },
  ],
};
export const examples: Entry[] = sampleEntries.map((entry) => ({
  ...entry,
  communities: sampleCommunityFor[entry.id] ?? [],
  public: true,
  problem: sampleProblemFor[entry.id],
  lessons: sampleLessons[entry.id],
}));

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
