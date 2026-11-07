import type { Topic } from "./types";

/** An open group around a shared kind of problem. Anyone can read, join and post. */
export interface Community {
  slug: string;
  name: string;
  about: string;
  topic: Topic;
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
    topic: "Food & farming",
    sample: true,
  },
  {
    slug: "fix-it-at-home",
    name: "Fix it at home",
    about:
      "Furniture, plumbing, heat and the repairs you would rather do yourself before calling someone.",
    topic: "Making & fixing",
    sample: true,
  },
  {
    slug: "web-developers",
    name: "Web developers",
    about:
      "Bugs that only appear in production, builds that fail in CI, and the fixes that held.",
    topic: "Software",
    sample: true,
  },
  {
    slug: "maths-and-physics-help",
    name: "Maths and physics help",
    about:
      "Homework and lab work, shown step by step. Hints first, so you still learn it yourself.",
    topic: "Research",
    sample: true,
  },
  {
    slug: "engineering-failures",
    name: "Engineering failures",
    about:
      "Documented failures in structures and machines, and what designers changed afterwards.",
    topic: "Making & fixing",
    sample: true,
  },
  {
    slug: "classroom-research",
    name: "Classroom research",
    about:
      "Teachers and students testing ideas in real classrooms, including the results that showed nothing.",
    topic: "Research",
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
