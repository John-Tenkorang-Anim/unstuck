import { samplePictures } from "./data";
import type { Clip, Picture, Topic } from "./types";

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
  /** 1-based page for pins on a PDF. */
  page?: number;
  /** Position as a fraction of the image, so pins survive any display size. */
  x: number;
  y: number;
  label: string;
}
/**
 * Shown working. Steps take inline maths between $…$, code keeps its line
 * numbers and output, and data is a small CSV. Feedback can point at a step,
 * a line or a row, the way a marker circles one line on a page.
 */
export type Block =
  | { kind: "steps"; title: string; steps: string[] }
  | {
      kind: "code";
      title: string;
      language: string;
      code: string;
      output?: string;
      expected?: string;
    }
  | { kind: "data"; title: string; csv: string; note?: string };
export interface SessionNote {
  id: string;
  alias: string;
  role: string;
  type: NoteType;
  body: string;
  pin?: string;
  at?: number;
  /** 1-based step, code line or data row in the session's working. */
  step?: number;
  line?: number;
  row?: number;
  page?: number;
  resolved?: boolean;
}
/** A stable key for whatever a note points at, used for grouping and focus. */
export function anchorKey(
  note: Pick<SessionNote, "pin" | "at" | "step" | "line" | "row">,
) {
  if (note.pin) return `pin:${note.pin}`;
  if (note.step) return `step:${note.step}`;
  if (note.line) return `line:${note.line}`;
  if (note.row) return `row:${note.row}`;
  if (note.page) return `page:${note.page}`;
  if (note.at !== undefined) return `t:${note.at}`;
  return "whole";
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
  /** A shared video of the work, with its marked moments. */
  clip?: Clip;
  /** A shared PDF of the work. */
  pdf?: { src: string; name: string; bytes: number };
  /** Who opened the session, for shared sessions. */
  author?: string;
  blocks?: Block[];
  /** Hints only: graded work, so reviewers point at the problem without solving it. */
  mode?: "hints" | "full";
  course?: string;
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
    id: "integration-by-parts-sign",
    kind: "critique",
    title: "Integration by parts: my answer is off by a sign",
    field: "Research",
    specialty: "Teaching & coursework",
    level: "First-year calculus",
    course: "Calculus II · Problem set 4, question 3",
    mode: "hints",
    status: "in-review",
    opened: "2026-11-06",
    wentWrong:
      "When I differentiate my answer to check it, I get the negative of what I started with.",
    ask: "Where does the sign go wrong? Please don’t give me the final answer, it’s graded.",
    blocks: [
      {
        kind: "steps",
        title: "My working",
        steps: [
          "Find $\\int x \\sin x \\, dx$. Choose $u = x$ and $dv = \\sin x \\, dx$.",
          "Then $du = dx$ and $v = \\cos x$.",
          "So $\\int x \\sin x \\, dx = uv - \\int v \\, du = x \\cos x - \\int \\cos x \\, dx$.",
          "$= x \\cos x - \\sin x + C$",
          "Check: $\\frac{d}{dx}(x \\cos x - \\sin x) = \\cos x - x \\sin x - \\cos x = -x \\sin x$, which should have been $x \\sin x$.",
        ],
      },
    ],
    pins: [],
    rounds: [
      {
        n: 1,
        note: "Typed up from my handwritten working.",
        notes: [
          {
            id: "n1",
            alias: "kind-tutor-27",
            role: "Practitioner · maths teaching assistant",
            type: "question",
            step: 2,
            body: "Try differentiating your $v$. Do you get back exactly $\\sin x$?",
          },
          {
            id: "n2",
            alias: "kind-tutor-27",
            role: "Practitioner · maths teaching assistant",
            type: "strength",
            step: 5,
            body: "Checking by differentiating is exactly the right habit. It’s how you caught this.",
          },
          {
            id: "n3",
            alias: "careful-limit-03",
            role: "Peer · first-year student",
            type: "suggestion",
            step: 3,
            body: "Once step 2 is fixed, redo this line slowly. A sign that changes there carries through every later step.",
          },
        ],
      },
    ],
  },
  {
    id: "moving-average-off-by-one",
    kind: "critique",
    title: "My moving average drops the last value",
    field: "Software",
    specialty: "Coursework",
    level: "Intro to programming",
    course: "CS 1110 · Lab 6",
    mode: "hints",
    status: "open",
    opened: "2026-11-05",
    wentWrong:
      "With five values and a window of two I should get four averages, but I get three.",
    ask: "What am I missing in the loop? Hints are fine, I want to fix it myself.",
    blocks: [
      {
        kind: "code",
        title: "moving_average.py",
        language: "Python",
        code: "def moving_average(values, window):\n    averages = []\n    for i in range(len(values) - window):\n        chunk = values[i:i + window]\n        averages.append(sum(chunk) / window)\n    return averages\n\nprint(moving_average([1, 2, 3, 4, 5], 2))",
        output: "[1.5, 2.5, 3.5]",
        expected: "[1.5, 2.5, 3.5, 4.5]",
      },
    ],
    pins: [],
    rounds: [
      {
        n: 1,
        note: "First submission to the lab autograder.",
        notes: [
          {
            id: "n1",
            alias: "steady-loop-44",
            role: "Practitioner · software engineer",
            type: "question",
            line: 3,
            body: "How many windows of size 2 fit in 5 values? Count them by hand, then count how many times this loop runs.",
          },
          {
            id: "n2",
            alias: "steady-loop-44",
            role: "Practitioner · software engineer",
            type: "strength",
            line: 4,
            body: "Slicing with values[i:i + window] is clear and correct. The bug isn’t here.",
          },
        ],
      },
    ],
  },
  {
    id: "pendulum-g-too-high",
    kind: "critique",
    title: "Pendulum lab: my value of g comes out at 10.2",
    field: "Research",
    specialty: "Lab & bench",
    level: "Physics 1 lab",
    course: "PHYS 1112 · Lab 2, simple pendulum",
    mode: "full",
    status: "in-review",
    opened: "2026-11-04",
    wentWrong:
      "I timed 10 swings at five lengths and used g = 4π²L/T². My average is 10.24 m/s², not 9.81.",
    ask: "Is my method wrong, or is it one of my measurements?",
    blocks: [
      {
        kind: "data",
        title: "Measurements",
        csv: "Length L (m),Time for 10 swings (s),Period T (s),g (m/s²)\n0.50,14.2,1.42,9.79\n0.75,17.4,1.74,9.78\n1.00,20.1,2.01,9.77\n1.25,20.2,2.02,12.09\n1.50,24.6,2.46,9.79",
        note: "Mean of g: 10.24 m/s²",
      },
    ],
    pins: [],
    rounds: [
      {
        n: 1,
        note: "Raw timings from the lab session, one run per length.",
        notes: [
          {
            id: "n1",
            alias: "bench-notes-12",
            role: "Practitioner · lab demonstrator",
            type: "issue",
            row: 4,
            body: "This row is the outlier. Its period barely changes from the 1.00 m row even though the pendulum is longer. If you timed 9 swings here, T would be 2.24 s and g would be 9.80.",
          },
          {
            id: "n2",
            alias: "bench-notes-12",
            role: "Practitioner · lab demonstrator",
            type: "strength",
            body: "The other four rows agree within 0.02 m/s², so your method is sound.",
          },
          {
            id: "n3",
            alias: "quiet-vernier-21",
            role: "Peer · physics student",
            type: "suggestion",
            body: "Plot T² against L. A straight line through the origin makes a single bad row stand out immediately, and the slope gives you g.",
          },
        ],
      },
    ],
  },
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
