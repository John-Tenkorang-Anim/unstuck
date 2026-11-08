import type { PublicMediaManifest } from "./contracts/media-v1";
export type EntryKind =
  "experience" | "problem" | "solution" | "idea" | "discovery" | "research";
export type Outcome = "worked" | "failed" | "mixed" | "ongoing";
/**
 * A category name. Categories are open: anyone can create one or join others'
 * (they are the communities), so this is any short label, not a fixed list.
 */
export type Topic = string;
/** Where a sample image or video came from, shown wherever it appears. */
export interface Credit {
  author: string;
  license: string;
  source: string;
}
export interface Picture {
  src: string;
  /** A 640px rendition for tiles and cards; `src` is the 1200px rendition. */
  small: string;
  width: number;
  height: number;
  alt: string;
  credit: Credit;
}
/** A point in a video that someone marked, such as the second it broke. */
export interface Moment {
  at: number;
  label: string;
  kind: "broke" | "worked" | "note";
  detail?: string;
}
export interface Clip {
  src: string;
  type: string;
  bytes: number;
  poster?: Picture;
  duration: number;
  title: string;
  moments: Moment[];
  transcript?: string;
  captions?: string;
  captionLanguage?: string;
  silent?: boolean;
  credit?: Credit;
}
export interface Entry {
  id: string;
  kind: EntryKind;
  title: string;
  excerpt: string;
  topic: Topic;
  outcome: Outcome | null;
  place: string;
  alias: string;
  date: string;
  illustration: "pots" | "code" | "chair" | "garden" | "water" | "light";
  readingMinutes: number;
  tried: number;
  helped: number;
  comments: number;
  context: Record<string, string>;
  sections: { title: string; body: string }[];
  evidence: {
    label: string;
    detail: string;
    state: "supported" | "proposed" | "verified";
  }[];
  example: boolean;
  /** A real, documented event retold as an entry, rather than a fictional one. */
  historical?: boolean;
  cover?: Picture;
  /** More photos after the cover, for published field notes. */
  photos?: Picture[];
  clip?: Clip;
  /** Account id of the person who published it, for shared field notes. */
  owner?: string;
  /** Hidden by reports or a moderator; only its owner and moderators see it. */
  hidden?: boolean;
  /** Whether a published note's media is visible yet. */
  mediaState?: "ready" | "pending" | "held";
  highStakes?: boolean;
  license?: string;
  /** Communities the author posted it to, by address. */
  communities?: string[];
  /** False when the author shared it only with their communities. */
  public?: boolean;
  media?: Attachment[];
  /** The problem this attempt belongs to, by id. */
  problem?: string;
  /** Reusable takeaways, each labelled for what kind of claim it is. */
  lessons?: Lesson[];
  /** Questions the contributor still can't answer. */
  questions?: string[];
  links?: { label: string; url: string }[];
  /** Evidence is the contributor's own account rather than documents. */
  personalAccount?: boolean;
  /** Whether the contributor invited suggestions and collaboration. */
  openToHelp?: boolean;
  affiliation?: string;
  collaborators?: string[];
}
/**
 * A lesson is a distinct, attributable statement. Saying whether it is an
 * observation, an interpretation or a recommendation keeps what was seen
 * apart from what someone thinks it means.
 */
export type LessonKind = "observation" | "interpretation" | "recommendation";
export interface Lesson {
  kind: LessonKind;
  text: string;
}
export const lessonLabel: Record<LessonKind, string> = {
  observation: "Observation",
  interpretation: "Possible explanation",
  recommendation: "Recommendation",
};
export interface Notebook {
  entries: EntrySummary[];
  mode: "examples" | "mixed" | "live" | "unavailable";
}

export type EntrySummary = Omit<Entry, "sections" | "context" | "media">;
export type Attachment = {
  id: string;
  kind: "image" | "video";
  state: "ready" | "processing" | "unavailable";
  manifest?: PublicMediaManifest;
};
export function summarizeEntry(entry: Entry): EntrySummary {
  const {
    sections: _sections,
    context: _context,
    media: _media,
    ...summary
  } = entry;
  return summary;
}
