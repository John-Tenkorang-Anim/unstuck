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
  highStakes?: boolean;
  license?: string;
}
export interface Notebook {
  entries: Entry[];
  mode: "examples" | "live" | "unavailable";
}
