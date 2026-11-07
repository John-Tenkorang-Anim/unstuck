import { kindLabels, outcomeLabels } from "./data";
import type { Session } from "./sessions";
import type { Entry, Moment, Picture } from "./types";

/**
 * Field-weighted BM25 over everything a person might remember about an attempt:
 * its words, the moments marked in its video, the descriptions of its photos,
 * its explanations, and the feedback in its sessions. Each result reports the
 * exact places it matched, so a search can land on the second or the spot.
 */
export type ResultType =
  | "all"
  | "videos"
  | "photos"
  | "failures"
  | "fixes"
  | "research"
  | "questions"
  | "critique";
export const resultTypes: { key: ResultType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "videos", label: "Videos" },
  { key: "photos", label: "Photos" },
  { key: "failures", label: "Failures" },
  { key: "fixes", label: "Fixes" },
  { key: "research", label: "Research" },
  { key: "questions", label: "Questions" },
  { key: "critique", label: "Critique" },
];
export type AnchorKind = "moment" | "photo" | "section" | "evidence" | "note";
export interface Anchor {
  kind: AnchorKind;
  label: string;
  text: string;
  href: string;
  at?: number;
}
export interface Doc {
  id: string;
  source: "entry" | "session";
  href: string;
  title: string;
  summary: string;
  field: string;
  kindLabel: string;
  outcome: Entry["outcome"] | "critique" | "inquiry";
  place: string;
  picture?: Picture;
  duration?: number;
  moments: Moment[];
  tried: number;
  helped: number;
  types: Set<ResultType>;
  fields: { weight: number; text: string }[];
  anchors: Anchor[];
  evidence: Entry["evidence"];
  context: Record<string, string>;
}
export type Segment = { text: string; hit: boolean };
export interface Result {
  doc: Doc;
  score: number;
  snippet: Segment[];
  matched: Anchor[];
}

const stop = new Set(
  "a an and are as at be but by for from has have how i in is it its my of on or so that the this to was were what when where which why will with you your".split(
    " ",
  ),
);
export function stem(word: string) {
  if (word.length > 5 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss"))
    return word.slice(0, -1);
  return word;
}
export function tokens(text: string) {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word && !stop.has(word))
    .map(stem);
}
export const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function entryDoc(entry: Entry): Doc {
  const href = `/entries/${entry.id}`;
  const pictures = [entry.cover].filter(Boolean) as Picture[];
  const moments = entry.clip?.moments ?? [];
  const types = new Set<ResultType>(["all"]);
  if (entry.clip) types.add("videos");
  if (pictures.length) types.add("photos");
  if (entry.outcome === "failed" || entry.outcome === "mixed")
    types.add("failures");
  if (entry.kind === "solution" || entry.outcome === "worked")
    types.add("fixes");
  if (entry.kind === "research" || entry.topic === "Research")
    types.add("research");
  if (entry.kind === "problem") types.add("questions");
  const sections = entry.sections ?? [];
  return {
    id: entry.id,
    source: "entry",
    href,
    title: entry.title,
    summary: entry.excerpt,
    field: entry.topic,
    kindLabel: kindLabels[entry.kind],
    outcome: entry.outcome,
    place: entry.place,
    picture: entry.clip?.poster ?? entry.cover,
    duration: entry.clip?.duration,
    moments,
    tried: entry.tried,
    helped: entry.helped,
    types,
    evidence: entry.evidence ?? [],
    context: entry.context ?? {},
    fields: [
      { weight: 4, text: entry.title },
      { weight: 2, text: entry.excerpt },
      {
        weight: 3,
        text: moments.map((m) => `${m.label} ${m.detail ?? ""}`).join(" "),
      },
      { weight: 2, text: (entry.evidence ?? []).map((e) => e.label).join(" ") },
      { weight: 1.5, text: pictures.map((p) => p.alt).join(" ") },
      {
        weight: 1.5,
        text: `${entry.topic} ${entry.place} ${Object.values(entry.context ?? {}).join(" ")}`,
      },
      {
        weight: 1,
        text: sections.map((s) => `${s.title} ${s.body}`).join(" "),
      },
    ],
    anchors: [
      ...moments.map((m) => ({
        kind: "moment" as const,
        label: `Video ${clock(m.at)}`,
        text: `${m.label}. ${m.detail ?? ""}`,
        href: `${href}?t=${Math.floor(m.at)}#clip`,
        at: m.at,
      })),
      ...pictures.map((p) => ({
        kind: "photo" as const,
        label: "Photo",
        text: p.alt,
        href: `${href}#photo`,
      })),
      ...sections.map((s, i) => ({
        kind: "section" as const,
        label: s.title,
        text: s.body,
        href: `${href}#section-${i}`,
      })),
      ...(entry.evidence ?? []).map((e) => ({
        kind: "evidence" as const,
        label: `Explanation · ${e.state}`,
        text: e.label,
        href: `${href}#why`,
      })),
    ],
  };
}
export function sessionDoc(session: Session): Doc {
  const href = `/sessions/${session.id}`;
  const notes = session.rounds.flatMap((round) => round.notes);
  const working: Anchor[] = (session.blocks ?? []).flatMap((block) =>
    block.kind === "steps"
      ? block.steps.map((step, i) => ({
          kind: "section" as const,
          label: `Step ${i + 1}`,
          text: step
            .replace(/\$|\\[a-z]+/g, " ")
            .replace(/\s+/g, " ")
            .trim(),
          href,
        }))
      : block.kind === "code"
        ? [
            {
              kind: "section" as const,
              label: block.title,
              text: `${block.code} ${block.output ?? ""}`,
              href,
            },
          ]
        : [
            {
              kind: "section" as const,
              label: block.title,
              text: block.csv.replace(/,/g, " "),
              href,
            },
          ],
  );
  return {
    id: session.id,
    source: "session",
    href,
    title: session.title,
    summary: `${session.wentWrong} ${session.ask}`,
    field: session.field,
    kindLabel:
      session.kind === "critique" ? "Critique session" : "Inquiry session",
    outcome: session.kind,
    place: session.level ?? session.specialty,
    picture: session.work,
    moments: [],
    tried: 0,
    helped: notes.length,
    types: new Set<ResultType>([
      "all",
      "critique",
      ...(session.work ? (["photos"] as ResultType[]) : []),
      ...(session.kind === "inquiry" ? (["research"] as ResultType[]) : []),
    ]),
    evidence: [],
    context: {},
    fields: [
      { weight: 4, text: session.title },
      { weight: 2, text: `${session.wentWrong} ${session.ask}` },
      {
        weight: 1.5,
        text: `${session.field} ${session.specialty} ${session.level ?? ""} ${session.course ?? ""} ${session.work?.alt ?? ""}`,
      },
      { weight: 1.5, text: session.pins.map((p) => p.label).join(" ") },
      { weight: 1, text: notes.map((n) => n.body).join(" ") },
      { weight: 1, text: working.map((w) => w.text).join(" ") },
    ],
    anchors: [
      ...working,
      ...session.pins.map((p, i) => ({
        kind: "photo" as const,
        label: `Pin ${i + 1}`,
        text: p.label,
        href: `${href}#pin-${p.id}`,
      })),
      ...notes.map((n) => ({
        kind: "note" as const,
        label:
          n.at === undefined
            ? `${n.role.split(" · ")[0]} note`
            : `Note at ${clock(n.at)}`,
        text: n.body,
        href: `${href}#note-${n.id}`,
      })),
    ],
  };
}

function snippet(text: string, terms: Set<string>, length = 190): Segment[] {
  const words = text.split(/(\s+)/);
  const hits = words.map((word) => tokens(word).some((t) => terms.has(t)));
  const first = Math.max(0, hits.indexOf(true));
  let start = Math.max(0, first - 12);
  let size = 0;
  const out: Segment[] = [];
  if (start > 0) out.push({ text: "… ", hit: false });
  for (let i = start; i < words.length && size < length; i++) {
    out.push({ text: words[i], hit: hits[i] });
    size += words[i].length;
  }
  if (size >= length) out.push({ text: " …", hit: false });
  return out.reduce<Segment[]>((merged, segment) => {
    const last = merged.at(-1);
    if (last && last.hit === segment.hit) last.text += segment.text;
    else merged.push({ ...segment });
    return merged;
  }, []);
}

export function search(
  docs: Doc[],
  query: string,
  filters: { type?: ResultType; field?: string } = {},
) {
  const terms = [...new Set(tokens(query))];
  const termSet = new Set(terms);
  const tokenized = docs.map((doc) => doc.fields.map((f) => tokens(f.text)));
  const average = Array.from({ length: 8 }, (_, i) =>
    Math.max(
      1,
      tokenized.reduce((s, d) => s + (d[i]?.length ?? 0), 0) /
        Math.max(1, docs.length),
    ),
  );
  const documentFrequency = new Map(
    terms.map((term) => [
      term,
      tokenized.filter((doc) => doc.some((field) => field.includes(term)))
        .length,
    ]),
  );
  const n = docs.length;
  const scored: Result[] = [];
  docs.forEach((doc, index) => {
    if (filters.field && doc.field !== filters.field) return;
    let score = 0;
    if (terms.length) {
      let covered = 0;
      for (const term of terms) {
        const df = documentFrequency.get(term) ?? 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        let termScore = 0;
        doc.fields.forEach((field, i) => {
          const words = tokenized[index][i];
          const tf = words.filter((w) => w === term).length;
          if (!tf) return;
          const norm =
            1.2 * (0.25 + 0.75 * (words.length / average[Math.min(i, 7)]));
          termScore += field.weight * ((tf * 2.2) / (tf + norm));
        });
        if (termScore) covered += 1;
        score += idf * termScore;
      }
      if (!score) return;
      score *= 0.6 + 0.4 * (covered / terms.length);
      if (
        `${doc.title} ${doc.summary}`
          .toLowerCase()
          .includes(query.toLowerCase().trim())
      )
        score *= 1.3;
    } else score = 1;
    score *= 1 + 0.1 * Math.log1p(doc.helped);
    const matched = terms.length
      ? doc.anchors
          .map((anchor) => ({
            anchor,
            hits: tokens(`${anchor.label} ${anchor.text}`).filter((t) =>
              termSet.has(t),
            ).length,
          }))
          .filter((a) => a.hits)
          .sort(
            (a, b) => b.hits - a.hits || (a.anchor.kind === "moment" ? -1 : 1),
          )
          .slice(0, 3)
          .map((a) => a.anchor)
      : [];
    const source = terms.length
      ? ([doc.summary, ...matched.map((a) => a.text)].find((text) =>
          tokens(text).some((t) => termSet.has(t)),
        ) ?? doc.summary)
      : doc.summary;
    scored.push({ doc, score, matched, snippet: snippet(source, termSet) });
  });
  scored.sort((a, b) => b.score - a.score);
  const counts = Object.fromEntries(
    resultTypes.map(({ key }) => [
      key,
      scored.filter((r) => r.doc.types.has(key)).length,
    ]),
  ) as Record<ResultType, number>;
  const type = filters.type ?? "all";
  const results = scored.filter((r) => r.doc.types.has(type));
  return {
    terms,
    results,
    counts,
    fieldCounts: countBy(scored, (r) => r.doc.field),
  };
}
function countBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, number>();
  for (const item of items) map.set(key(item), (map.get(key(item)) ?? 0) + 1);
  return map;
}

/** Numbers, not prose: what the matching attempts add up to. */
export function summarize(results: Result[]) {
  const entries = results.filter((r) => r.doc.source === "entry");
  const outcomes = (["worked", "failed", "mixed", "ongoing"] as const)
    .map((key) => ({
      key,
      label: outcomeLabels[key],
      count: entries.filter((r) => r.doc.outcome === key).length,
    }))
    .filter((o) => o.count);
  const open = entries.filter((r) => r.doc.outcome === null).length;
  const breaks = entries
    .flatMap((r) =>
      r.doc.moments
        .filter((m) => m.kind === "broke")
        .map((m) => ({ moment: m, doc: r.doc })),
    )
    .slice(0, 3);
  const explanations = entries
    .flatMap((r) => r.doc.evidence.map((e) => ({ ...e, doc: r.doc })))
    .sort((a, b) => rank(b.state) - rank(a.state))
    .slice(0, 3);
  return { total: entries.length, outcomes, open, breaks, explanations };
}
const rank = (state: string) =>
  ({ verified: 3, supported: 2, proposed: 1 })[state] ?? 0;
