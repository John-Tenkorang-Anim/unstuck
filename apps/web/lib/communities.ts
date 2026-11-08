import type { Topic } from "./types";

/** An open group around a shared kind of problem. Anyone can read, join and post. */
export interface Community {
  slug: string;
  name: string;
  about: string;
  topic: Topic;
  /** What members agree to when they join. */
  rules: string[];
  /** Sample communities ship with the app; the rest are created by people. */
  sample?: boolean;
  id?: string;
  owner?: string;
  hidden?: boolean;
}
export interface CommunityStats {
  members: number;
  questions: number;
  unanswered: number;
  library: number;
  joined: boolean;
}

export const sampleCommunities: Community[] = [
  {
    slug: "smallholder-growers",
    name: "Smallholder growers",
    about:
      "Small farms and kitchen gardens: storage, soil, water, pests and what the weather did this year.",
    topic: "Agriculture",
    rules: [
      "Say where you farm and what the weather was doing.",
      "Share what you measured, even roughly.",
      "Name products only when they mattered to the result.",
    ],
    sample: true,
  },
  {
    slug: "fix-it-at-home",
    name: "Fix it at home",
    about:
      "Furniture, plumbing, heat and the repairs you would rather do yourself before calling someone.",
    topic: "Everyday life",
    rules: [
      "Photos of the problem help more than descriptions.",
      "Say when a repair needs a professional, such as gas or mains wiring.",
      "Report back on whether a fix held.",
    ],
    sample: true,
  },
  {
    slug: "web-developers",
    name: "Web developers",
    about:
      "Bugs that only appear in production, builds that fail in CI, and the fixes that held.",
    topic: "Technology",
    rules: [
      "Include versions and the exact error.",
      "Remove secrets and customer data from logs before posting.",
      "Say what you already ruled out.",
    ],
    sample: true,
  },
  {
    slug: "maths-and-physics-help",
    name: "Maths and physics help",
    about:
      "Homework and lab work, shown step by step. Hints first, so you still learn it yourself.",
    topic: "Education",
    rules: [
      "Show your working, not just the answer you got.",
      "Give hints first. Full solutions only if the asker says it isn’t graded.",
      "Be kind. Everyone here is learning.",
    ],
    sample: true,
  },
  {
    slug: "engineering-failures",
    name: "Engineering failures",
    about:
      "Documented failures in structures and machines, and what designers changed afterwards.",
    topic: "Engineering",
    rules: [
      "Cite sources for historical cases.",
      "Separate what is known from what is your interpretation.",
      "No blame aimed at named individuals.",
    ],
    sample: true,
  },
  {
    slug: "classroom-research",
    name: "Classroom research",
    about:
      "Teachers and students testing ideas in real classrooms, including the results that showed nothing.",
    topic: "Education",
    rules: [
      "Never post students’ names, faces or identifiable work.",
      "Describe your method and sample size.",
      "Null results are welcome here.",
    ],
    sample: true,
  },
  {
    slug: "energy-and-materials",
    name: "Energy & materials",
    about:
      "Solar, batteries, coatings and materials that behaved differently outside the lab.",
    topic: "Energy & materials",
    rules: ["Say how long it was tested and in what conditions."],
    sample: true,
  },
  {
    slug: "small-business",
    name: "Small business",
    about:
      "Selling, delivering, pricing and running a small business, including what cost money.",
    topic: "Small business",
    rules: ["Share numbers where you can, even rough ones."],
    sample: true,
  },
  {
    slug: "recycling-and-waste",
    name: "Recycling & waste",
    about:
      "Sorting, collecting and reusing waste in streets, schools and towns.",
    topic: "Recycling & waste",
    rules: [],
    sample: true,
  },
  {
    slug: "teaching-maths",
    name: "Teaching maths",
    about:
      "What helped students learn mathematics, and what took time without helping.",
    topic: "Teaching maths",
    rules: ["Never post students’ names or identifiable work."],
    sample: true,
  },
  {
    slug: "lab-experiments",
    name: "Lab experiments",
    about:
      "Experiments that didn’t replicate, scale or behave, with methods and data.",
    topic: "Lab experiments",
    rules: ["Describe your method and sample size."],
    sample: true,
  },
];

/** Lowercase words joined by hyphens, as used in community addresses. */
export function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
/** Entry kinds that ask for help. Everything else can go in a library. */
export const isQuestion = (kind: string) => kind === "problem";

/** Members' shared promises, on top of each community's own rules. */
export const platformRules = [
  "Keep people private: no names, faces or contact details without consent.",
  "Share experience, not professional advice.",
  "Disagree with ideas, not people.",
];
export interface Member {
  name: string;
  role: string;
  intro: string;
  joined: string;
}
