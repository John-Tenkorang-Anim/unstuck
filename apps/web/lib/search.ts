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
  { key: "questions", label: "Open questions" },
  { key: "fixes", label: "What worked" },
  { key: "failures", label: "What failed" },
  { key: "videos", label: "Videos" },
  { key: "photos", label: "Photos" },
  { key: "research", label: "Research" },
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
  /** Communities an entry was posted to, to suggest where to ask next. */
  communities?: string[];
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
/** Words people use for the same thing. Any one finds the others. */
const synonymGroups = [
  ["fridge", "refrigerator", "refrigeration"],
  ["fail", "failure", "broke", "broken", "collapse"],
  ["error", "bug", "crash", "exception"],
  ["fix", "repair", "solution", "solve"],
  ["mold", "mould"],
  ["color", "colour"],
  ["hot", "heat", "warm"],
  ["cool", "cold", "chill"],
  ["math", "maths", "mathematics"],
  ["memory", "ram", "heap"],
  ["video", "film", "clip"],
  ["photo", "picture", "image"],
];
const synonyms = new Map<string, string[]>();
for (const group of synonymGroups) {
  const stems = group.map(stem);
  for (const s of stems)
    synonyms.set(s, [
      ...new Set([...(synonyms.get(s) ?? []), ...stems.filter((o) => o !== s)]),
    ]);
}

/** "exact phrases", -excluded words, and everything else as plain words. */
export function parseQuery(query: string) {
  const phrases: string[] = [];
  const excluded: string[] = [];
  const rest = query
    .replace(/"([^"]+)"/g, (_, phrase: string) => {
      phrases.push(phrase.trim().toLowerCase());
      return ` ${phrase} `;
    })
    .replace(/(^|\s)-(\S+)/g, (_, space: string, word: string) => {
      excluded.push(...tokens(word));
      return space;
    });
  return { words: rest, phrases: phrases.filter(Boolean), excluded };
}

/** Edit distance with transpositions, giving up once it passes `limit`. */
function distance(a: string, b: string, limit: number) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let before: number[] = [];
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        value = Math.min(value, before[j - 2] + 1);
      current.push(value);
      best = Math.min(best, value);
    }
    if (best > limit) return limit + 1;
    before = previous;
    previous = current;
  }
  return previous[b.length];
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
  if (entry.kind === "research" || entry.topic === "Science")
    types.add("research");
  if (entry.kind === "problem") types.add("questions");
  const sections = entry.sections ?? [];
  return {
    id: entry.id,
    source: "entry",
    href,
    communities: entry.communities ?? [],
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
  const parsed = parseQuery(query);
  const tokenized = docs.map((doc) => doc.fields.map((f) => tokens(f.text)));
  const vocabulary = new Map<string, number>();
  tokenized.forEach((doc) =>
    new Set(doc.flat()).forEach((word) =>
      vocabulary.set(word, (vocabulary.get(word) ?? 0) + 1),
    ),
  );
  // Misspelled words become the closest word people actually used.
  const corrections = new Map<string, string>();
  const terms = [...new Set(tokens(parsed.words))].map((term) => {
    if (
      vocabulary.has(term) ||
      synonyms.has(term) ||
      /^\d/.test(term) ||
      term.length < 4
    )
      return term;
    const limit = term.length >= 8 ? 2 : 1;
    let best: [string, number, number] | null = null;
    // Candidates: every word in the notes, plus the synonym list's words.
    const candidates: [string, number][] = [
      ...vocabulary,
      ...[...synonyms.keys()]
        .filter((w) => !vocabulary.has(w))
        .map((w): [string, number] => [w, 0]),
    ];
    for (const [word, df] of candidates) {
      const d = distance(term, word, limit);
      if (
        d <= limit &&
        (!best || d < best[1] || (d === best[1] && df > best[2]))
      )
        best = [word, d, df];
    }
    if (!best) return term;
    corrections.set(term, best[0]);
    return best[0];
  });
  const termSet = new Set(
    terms.flatMap((t) => [t, ...(synonyms.get(t) ?? [])]),
  );
  const alternatives = (term: string) => [term, ...(synonyms.get(term) ?? [])];
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
      tokenized.filter((doc) =>
        doc.some((field) => alternatives(term).some((t) => field.includes(t))),
      ).length,
    ]),
  );
  const n = docs.length;
  const scored: Result[] = [];
  docs.forEach((doc, index) => {
    if (filters.field && doc.field !== filters.field) return;
    if (
      parsed.excluded.length &&
      tokenized[index].some((field) =>
        field.some((w) => parsed.excluded.includes(w)),
      )
    )
      return;
    if (parsed.phrases.length) {
      const text = doc.fields
        .map((f) => f.text)
        .join(" ")
        .toLowerCase()
        .replace(/\s+/g, " ");
      if (!parsed.phrases.every((p) => text.includes(p))) return;
    }
    let score = 0;
    if (terms.length) {
      let covered = 0;
      for (const term of terms) {
        const df = documentFrequency.get(term) ?? 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        let termScore = 0;
        doc.fields.forEach((field, i) => {
          const words = tokenized[index][i];
          const alts = alternatives(term);
          // An exact word counts fully; a synonym a little less.
          const tf =
            words.filter((w) => w === term).length +
            0.7 * words.filter((w) => w !== term && alts.includes(w)).length;
          if (!tf) return;
          const norm =
            1.2 * (0.25 + 0.75 * (words.length / average[Math.min(i, 7)]));
          termScore += field.weight * ((tf * 2.2) / (tf + norm));
        });
        if (termScore) covered += 1;
        score += idf * termScore;
      }
      if (!score) return;
      // Results that contain every word should outrank ones that repeat a single word.
      score *= 0.25 + 0.75 * (covered / terms.length) ** 2;
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
  // "Showing results for …" when a word was corrected.
  const corrected = corrections.size
    ? parsed.words.replace(/[\p{L}\p{N}]+/gu, (word) => {
        const fixed = corrections.get(stem(word.toLowerCase()));
        return fixed ?? word;
      })
    : null;
  return {
    terms,
    corrected,
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
