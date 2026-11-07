import type { PublicMediaManifest } from "./contracts/media-v1";
export type EntryKind =
  "experience" | "problem" | "solution" | "idea" | "discovery" | "research";
export type Outcome = "worked" | "failed" | "mixed" | "ongoing";
export type Topic =
  | "Food & farming"
  | "Making & fixing"
  | "Software"
  | "Everyday life"
  | "Research"
  | "Community";
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
  clip?: Clip;
  highStakes?: boolean;
  license?: string;
  media?: Attachment[];
}
export interface Notebook {
  entries: EntrySummary[];
  mode: "examples" | "live" | "unavailable";
}

export type EntrySummary = Omit<
  Entry,
  "sections" | "context" | "evidence" | "media"
>;
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
    evidence: _evidence,
    media: _media,
    ...summary
  } = entry;
  return summary;
}
