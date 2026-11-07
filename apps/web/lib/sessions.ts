import { samplePictures } from "./data";
import type { Picture, Topic } from "./types";

/**
 * A session is where feedback happens. Every critique or investigation gets its
 * own space with the work, the exact places being discussed, and rounds that
 * track revisions, instead of a flat comment thread under a post.
 */
export type SessionKind = "critique" | "inquiry";
export type NoteType =
  "issue" | "suggestion" | "question" | "strength" | "hypothesis" | "evidence";
export interface Pin {
  id: string;
  /** Position as a fraction of the image, so pins survive any display size. */
  x: number;
  y: number;
  label: string;
}
export interface SessionNote {
  id: string;
  alias: string;
  role: string;
  type: NoteType;
  body: string;
  pin?: string;
  at?: number;
  resolved?: boolean;
}
export interface Round {
  n: number;
  note: string;
  notes: SessionNote[];
}
export type SessionStatus = "open" | "in-review" | "revised" | "resolved";
export interface Session {
  id: string;
  kind: SessionKind;
  title: string;
  field: Topic;
  specialty: string;
  level?: string;
  status: SessionStatus;
  wentWrong: string;
  ask: string;
  work?: Picture;
  entryId?: string;
  pins: Pin[];
  rounds: Round[];
  opened: string;
}
export const noteTypes: Record<SessionKind, NoteType[]> = {
  critique: ["issue", "suggestion", "question", "strength"],
  inquiry: ["hypothesis", "evidence", "question"],
};
export const noteLabels: Record<NoteType, string> = {
  issue: "Issue",
  suggestion: "Suggestion",
  question: "Question",
  strength: "Working well",
  hypothesis: "Hypothesis",
  evidence: "Evidence",
};
export const statusLabels: Record<SessionStatus, string> = {
  open: "Waiting for feedback",
  "in-review": "In review",
  revised: "Revised",
  resolved: "Resolved",
};

// Fictional sessions that show how critique works. The photos are real and credited.
export const sampleSessions: Session[] = [
  {
    id: "first-print-spaghetti",
    kind: "critique",
    title: "My first 3D print turned into spaghetti halfway up",
    field: "Making & fixing",
    specialty: "Fabrication",
    level: "First-year design student",
    status: "in-review",
    opened: "2026-11-05",
    wentWrong:
      "The base printed cleanly for about a centimetre, then the layers stopped stacking and the nozzle dragged loose strands around.",
    ask: "Is this a settings problem or a problem with my model? I have to reprint it for a project review on Friday.",
    work: samplePictures.print,
    pins: [
      { id: "p1", x: 0.5, y: 0.78, label: "Base looks solid here" },
      { id: "p2", x: 0.52, y: 0.5, label: "Where the layers start to fail" },
      { id: "p3", x: 0.45, y: 0.22, label: "Loose strands on top" },
    ],
    rounds: [
      {
        n: 1,
        note: "First attempt, default slicer settings, no supports.",
        notes: [
          {
            id: "n1",
            alias: "steady-lathe-31",
            role: "Practitioner · makerspace technician",
            type: "issue",
            pin: "p2",
            body: "This is where the print lost its footing. The part probably came loose from the bed or got knocked by the nozzle, so every layer after this was printed into the air.",
          },
          {
            id: "n2",
            alias: "steady-lathe-31",
            role: "Practitioner · makerspace technician",
            type: "suggestion",
            pin: "p1",
            body: "Add a brim of about 5 mm and clean the bed before printing. A wider first layer gives a tall, narrow part much more grip.",
          },
          {
            id: "n3",
            alias: "quiet-filament-08",
            role: "Peer · second-year student",
            type: "question",
            body: "Does your model have overhangs past 45 degrees around that height? Unsupported overhangs fail in a very similar way.",
          },
          {
            id: "n4",
            alias: "quiet-filament-08",
            role: "Peer · second-year student",
            type: "strength",
            pin: "p1",
            body: "Your first layers are even and well squished. Bed levelling looks fine, so you can rule that out.",
          },
        ],
      },
    ],
  },
  {
    id: "dull-solder-joints",
    kind: "critique",
    title: "Circuit works only when I press on the board",
    field: "Making & fixing",
    specialty: "Electronics",
    level: "Electronics course, lab 4",
    status: "open",
    opened: "2026-11-06",
    wentWrong:
      "My amplifier kit cuts in and out. If I press on one corner of the board it starts working again.",
    ask: "Can someone look at my joints and tell me which ones to redo?",
    work: samplePictures.solder,
    pins: [{ id: "p1", x: 0.47, y: 0.5, label: "This joint looks grey" }],
    rounds: [
      {
        n: 1,
        note: "Photo taken under a desk lamp, before any rework.",
        notes: [
          {
            id: "n1",
            alias: "bright-wire-14",
            role: "Practitioner · electronics technician",
            type: "issue",
            pin: "p1",
            body: "That dull, lumpy surface is a classic cold joint. The solder sat on the lead without flowing into the pad, so the connection breaks when the board flexes.",
          },
        ],
      },
    ],
  },
  {
    id: "why-did-tacoma-twist",
    kind: "inquiry",
    title: "Why did the deck start twisting instead of just bouncing?",
    field: "Making & fixing",
    specialty: "Structures",
    level: "Structural dynamics reading group",
    status: "in-review",
    opened: "2026-11-06",
    entryId: "tacoma-narrows-1940",
    wentWrong:
      "The film shows months of vertical waves, then a sudden switch to twisting on the last day.",
    ask: "What changed at that moment, and is 'resonance' the right word for it?",
    pins: [],
    rounds: [
      {
        n: 1,
        note: "Anchored to the moments in the film.",
        notes: [
          {
            id: "n1",
            alias: "patient-girder-52",
            role: "Peer · civil engineering student",
            type: "hypothesis",
            at: 62,
            body: "Something allowed the two halves of the deck to move in opposite directions. Once twisting was possible, the wind could drive it.",
          },
          {
            id: "n2",
            alias: "careful-truss-19",
            role: "Practitioner · bridge engineer",
            type: "evidence",
            at: 62,
            body: "Accounts of the failure describe a cable band near midspan slipping shortly before the twisting began. That would explain why the motion changed on that day.",
          },
          {
            id: "n3",
            alias: "careful-truss-19",
            role: "Practitioner · bridge engineer",
            type: "hypothesis",
            at: 116,
            body: "Calling it resonance undersells it. With flutter the wind force depends on the motion itself, so the twisting feeds itself. Forced resonance needs a gust pattern at the right frequency.",
          },
        ],
      },
    ],
  },
];
export const sessionById = (id: string) =>
  sampleSessions.find((session) => session.id === id);
