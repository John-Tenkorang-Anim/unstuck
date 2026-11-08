import "server-only";
import { currentAccount } from "./auth.server";
import { hasDatabase, query } from "./db.server";
import { cleanVideoText } from "./media/captions";
import {
  clean,
  cleanMoments,
  cleanPins,
  insertEntry,
  newId,
  saveFile,
  storedEntries,
  storedEntry,
  StoreError,
  discardStagedFiles,
  type StagedFile,
} from "./store.server";
import { communityBySlug } from "./communities.server";
import { categoryName, categorySlug } from "./taxonomy";
import type {
  Entry,
  EntryKind,
  Moment,
  Outcome,
  Picture,
  Topic,
} from "./types";

/** The parts of a published field note that point at stored files. */
type StoredMedia = {
  file: string;
  kind: "image" | "video" | "pdf";
  alt: string;
  width?: number;
  height?: number;
  duration?: number;
  moments?: Moment[];
  pins?: { x: number; y: number; label: string }[];
  transcript?: string;
  captions?: string;
  captionLanguage?: string;
  silent?: boolean;
};
type StoredEntry = Entry & { files?: StoredMedia[]; hidden?: boolean };

const topicFor: Record<string, Topic> = {
  everyday: "Everyday life",
  making: "Engineering",
  farming_food: "Agriculture",
  software: "Technology",
  research: "Science",
  work_business: "Business",
  community: "Community",
};
const outcomes: Record<EntryKind, Outcome[]> = {
  experience: ["worked", "failed", "mixed"],
  problem: [],
  solution: ["worked", "mixed"],
  idea: [],
  discovery: ["worked", "mixed", "ongoing"],
  research: ["worked", "failed", "mixed"],
};

/** How a contributor described the outcome, mapped to kind and outcome. */
const classifications: Record<string, [EntryKind, Outcome]> = {
  failed: ["experience", "failed"],
  partial: ["experience", "mixed"],
  worked: ["experience", "worked"],
  unexpected: ["discovery", "mixed"],
  ongoing: ["discovery", "ongoing"],
};
const licences = [
  "CC BY 4.0",
  "CC BY-SA 4.0",
  "CC BY-NC 4.0",
  "All rights reserved",
];
type Built = Pick<
  StoredEntry,
  | "kind"
  | "title"
  | "outcome"
  | "sections"
  | "excerpt"
  | "topic"
  | "place"
  | "context"
> &
  Partial<StoredEntry>;

/**
 * An attempt from the Contribute flow: describe, evidence, lessons, rights.
 * Only the description is required; everything else makes it more useful.
 */
async function fromContribution(
  input: Record<string, unknown>,
): Promise<Built> {
  const text = (key: string, max = 10000) =>
    typeof input[key] === "string"
      ? (input[key] as string).trim().slice(0, max)
      : "";
  const lines = (key: string, max = 12) =>
    text(key)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, max);
  const [kind, outcome] =
    classifications[text("classification", 20)] ??
    (() => {
      throw new StoreError("Say how it turned out.");
    })();
  const title = clean.text(input.title, 6, 160, "The title");
  const trying = clean.text(
    input.trying,
    3,
    10000,
    "What you were trying to do",
  );
  const happened = clean.text(input.happened, 3, 10000, "What happened");
  const detailed = input.detailed === true;
  const sections = [
    ["What were we trying to achieve?", trying],
    ["What did we try?", text("approach")],
    ["What happened?", happened],
    ["What did we expect?", text("expected")],
    ["What may explain the difference?", text("why")],
    ["Conditions and constraints", text("conditions")],
    ...(detailed
      ? ([
          ["Method", text("methods")],
          ["Measurements", text("measurements")],
          ["Before and after", text("beforeAfter")],
          ["Resources used", text("resources")],
          ["Relevant circumstances", text("circumstances")],
          ["Limitations", text("limitations")],
        ] as const)
      : []),
    ["What would we do differently?", text("change")],
  ]
    .filter(([, body]) => body)
    .map(([title, body]) => ({ title, body }));
  const context: Record<string, string> = {};
  if (Array.isArray(input.context))
    for (const row of input.context.slice(0, 12) as {
      key?: unknown;
      value?: unknown;
    }[]) {
      const k = String(row?.key ?? "")
        .trim()
        .slice(0, 40);
      const v = String(row?.value ?? "")
        .trim()
        .slice(0, 120);
      if (k && v) context[k] = v;
    }
  const lessons = (Array.isArray(input.lessons) ? input.lessons : [])
    .slice(0, 8)
    .map((l: { kind?: unknown; text?: unknown }) => ({
      kind:
        (["observation", "interpretation", "recommendation"] as const).find(
          (k) => k === l?.kind,
        ) ?? "observation",
      text: String(l?.text ?? "")
        .trim()
        .slice(0, 500),
    }))
    .filter((l) => l.text.length >= 3);
  const links = (Array.isArray(input.links) ? input.links : [])
    .slice(0, 10)
    .map((l: { label?: unknown; url?: unknown }) => ({
      label: String(l?.label ?? "")
        .trim()
        .slice(0, 120),
      url: String(l?.url ?? "")
        .trim()
        .slice(0, 500),
    }))
    .filter((l) => /^https?:\/\/[^\s]+$/.test(l.url));
  let problem = text("problem", 200) || undefined;
  if (problem) {
    const { getProblem } = await import("./problems.server");
    if (!(await getProblem(problem))) problem = undefined;
  }
  const license = licences.includes(text("license", 40))
    ? text("license", 40)
    : "CC BY 4.0";
  return {
    kind:
      detailed &&
      (text("methods") || text("measurements")) &&
      kind === "experience"
        ? "research"
        : kind,
    title,
    outcome,
    sections,
    excerpt: happened.length > 220 ? `${happened.slice(0, 217)}…` : happened,
    topic: categoryName(input.category) || "General",
    place: text("place", 120) || "Not specified",
    context,
    lessons,
    links,
    questions: lines("questions", 8),
    personalAccount: input.personalAccount === true,
    openToHelp: input.openToHelp === true,
    affiliation: text("affiliation", 120) || undefined,
    collaborators: lines("collaborators", 10).map((c) => c.slice(0, 60)),
    license,
    problem,
  };
}

/** The original composer's shape, still accepted. */
function fromLegacy(input: Record<string, string>): Built {
  const kind = input.kind as EntryKind;
  if (!(kind in outcomes))
    throw new StoreError("Choose what kind of note this is.");
  const template = kind === "research" ? "research" : input.template;
  if (!(template in topicFor)) throw new StoreError("Choose a field.");
  const title = clean.text(input.title, 6, 160, "The title");
  const goal = clean.text(input.goal, 3, 10000, "What you were trying to do");
  const optional = (key: string) =>
    typeof input[key] === "string" ? input[key].trim().slice(0, 10000) : "";
  const outcome = outcomes[kind].includes(input.outcome as Outcome)
    ? (input.outcome as Outcome)
    : null;
  const country = /^[A-Z]{2}$/.test(input.country ?? "") ? input.country : "";
  const sections = [
    {
      title:
        kind === "problem" ? "Where I am stuck" : "What I was trying to do",
      body: goal,
    },
    {
      title: kind === "idea" ? "The idea" : "What I tried",
      body: optional("approach"),
    },
    {
      title: "How I tested it",
      body: kind === "research" ? optional("method") : "",
    },
    { title: "What happened", body: optional("result") },
    {
      title: "Limitations",
      body: kind === "research" ? optional("limitations") : "",
    },
    { title: "What I would tell the next person", body: optional("advice") },
  ].filter((s) => s.body);
  return {
    kind,
    title,
    outcome,
    sections,
    excerpt: goal.length > 220 ? `${goal.slice(0, 217)}…` : goal,
    topic: categoryName(input.field) || topicFor[template],
    place: country || "Not specified",
    context: country ? { Country: country } : {},
  };
}

/** Build an attempt from the Contribute form and its uploaded files. */
export async function createEntry(
  owner: { id: string; name: string },
  form: FormData,
) {
  const input = JSON.parse(String(form.get("entry") ?? "{}")) as Record<
    string,
    unknown
  >;
  const built =
    input.trying !== undefined
      ? await fromContribution(input)
      : fromLegacy(input as Record<string, string>);
  const raw = input;
  // The chosen category joins the places it appears, when it is a category.
  const chosen = Array.isArray(raw.communities)
    ? raw.communities.map(String)
    : [];
  const own = categorySlug(built.topic);
  if (
    own &&
    !chosen.includes(own) &&
    (await communityBySlug(own)) &&
    chosen.length < 5
  )
    chosen.push(own);
  const communities = await knownCommunities(chosen);
  const everyone = raw.public !== false;
  if (!everyone && !communities.length)
    throw new StoreError(
      "Choose where this should appear: everyone, a category, or both.",
    );
  const media = JSON.parse(String(form.get("media") ?? "[]")) as Record<
    string,
    unknown
  >[];
  if (!Array.isArray(media) || media.length > 9)
    throw new StoreError("Too many attachments.");
  const files: StoredMedia[] = [];
  const staged: StagedFile[] = [];
  try {
    for (const [index, meta] of media.entries()) {
      const upload = form.get(`file-${index}`);
      if (!(upload instanceof File) || !upload.size) continue;
      const alt = clean.text(meta.alt, 3, 300, "Each attachment’s description");
      const saved = await saveFile(
        owner.id,
        upload.name,
        Buffer.from(await upload.arrayBuffer()),
        { staged: true },
      );
      const { file, kind: fileKind } = saved;
      staged.push({ id: file.id, status: saved.intendedStatus });
      if (fileKind === "video" && files.some((f) => f.kind === "video"))
        throw new StoreError("One video per note.");
      files.push({
        file: file.id,
        kind: fileKind,
        alt,
        ...(fileKind === "image"
          ? {
              width: saved.width,
              height: saved.height,
              pins: cleanPins(meta.pins),
            }
          : {}),
        ...(fileKind === "video"
          ? {
              ...(() => {
                try {
                  return cleanVideoText(meta);
                } catch (error) {
                  throw new StoreError((error as Error).message);
                }
              })(),
              duration: Number(meta.duration) || undefined,
              moments: cleanMoments(meta.moments),
            }
          : {}),
      });
    }
    const words = built.sections
      .map((s) => s.body)
      .join(" ")
      .split(/\s+/).length;
    const entry: StoredEntry = {
      license: "CC BY 4.0",
      ...built,
      id: newId(),
      alias: owner.name,
      date: new Date().toISOString().slice(0, 10),
      illustration: "garden",
      readingMinutes: Math.max(1, Math.ceil(words / 200)),
      tried: 0,
      helped: 0,
      comments: 0,
      evidence: [],
      example: false,
      owner: owner.id,
      files,
      communities,
      public: everyone,
    };
    await insertEntry(entry, owner.id, staged);
    return entry.id;
  } catch (error) {
    await discardStagedFiles(
      owner.id,
      staged.map((f) => f.id),
    ).catch(() => undefined);
    throw error;
  }
}

/** Resolve stored files to pictures and video, hiding media still under review. */
async function present(
  entry: StoredEntry,
  viewer?: { id: string; moderator: boolean },
): Promise<Entry> {
  const ids = (entry.files ?? []).map((f) => f.file);
  const statuses = ids.length
    ? new Map(
        (
          await query<{ id: string; status: string }>(
            "SELECT id, status FROM web.files WHERE id = ANY($1)",
            [ids],
          )
        ).map((r) => [r.id, r.status]),
      )
    : new Map<string, string>();
  const privileged =
    !!viewer && (viewer.id === entry.owner || viewer.moderator);
  const visible = (f: StoredMedia) =>
    statuses.get(f.file) === "approved" ||
    (privileged && statuses.get(f.file) === "pending");
  const pictures: Picture[] = (entry.files ?? [])
    .filter((f) => f.kind === "image" && visible(f))
    .map((f) => ({
      src: `/api/files/${f.file}`,
      small: `/api/files/${f.file}`,
      width: f.width ?? 1200,
      height: f.height ?? 900,
      alt: f.alt,
      credit: { author: entry.alias, license: "Shared on Unstuck", source: "" },
    }));
  const video = (entry.files ?? []).find(
    (f) => f.kind === "video" && visible(f),
  );
  const { files: _f, ...rest } = entry;
  const anyPending = (entry.files ?? []).some(
    (f) => statuses.get(f.file) === "pending",
  );
  return {
    ...rest,
    cover: pictures[0],
    photos: pictures.slice(1),
    clip: video
      ? {
          src: `/api/files/${video.file}`,
          type: "",
          bytes: 0,
          duration: video.duration ?? 60,
          title: video.alt,
          moments: video.moments ?? [],
          transcript: video.transcript,
          captions: video.captions,
          captionLanguage: video.captionLanguage,
          silent: video.silent,
          poster: pictures[0],
        }
      : undefined,
    mediaState: anyPending ? (privileged ? "pending" : "held") : "ready",
  };
}
/** Published field notes for the public feed and search. Community-only posts stay out. */
export async function publishedEntries(filter?: {
  problemIds?: string[];
}): Promise<Entry[]> {
  if (!hasDatabase()) return [];
  const rows = await query<{ id: string; owner: string; data: StoredEntry }>(
    `SELECT id, owner, data FROM web.entries WHERE NOT hidden AND (data->>'public') IS DISTINCT FROM 'false'
     ${filter?.problemIds ? "AND data->>'problem' = ANY($1)" : ""}
     ORDER BY created DESC LIMIT ${filter?.problemIds ? "500" : "200"}`,
    filter?.problemIds ? [filter.problemIds] : [],
  );
  return Promise.all(
    rows.map((r) => present({ ...r.data, id: r.id, owner: r.owner })),
  );
}
/** Everything posted to one community, public or not, newest first. */
export async function communityEntries(slug: string): Promise<Entry[]> {
  if (!hasDatabase()) return [];
  const rows = await query<{
    id: string;
    owner: string;
    data: StoredEntry;
    hidden: boolean;
  }>(
    `SELECT id, owner, data, hidden FROM web.entries
     WHERE NOT hidden AND data->'communities' ? $1 ORDER BY created DESC LIMIT 500`,
    [slug],
  );
  return Promise.all(
    rows.map((r) => present({ ...r.data, id: r.id, owner: r.owner })),
  );
}
export async function publishedEntry(id: string): Promise<Entry | undefined> {
  if (!hasDatabase()) return undefined;
  const entry = (await storedEntry(id)) as StoredEntry | undefined;
  if (!entry) return undefined;
  const viewer = await currentAccount();
  if (
    entry.hidden &&
    !(viewer && (viewer.id === entry.owner || viewer.moderator))
  )
    return undefined;
  return present(entry, viewer);
}

/** Up to five real, visible communities, without repeats. */
async function knownCommunities(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 5)
    throw new StoreError("Choose up to five communities.");
  const slugs = [...new Set(value.map(String))];
  for (const slug of slugs)
    if (!(await communityBySlug(slug)))
      throw new StoreError("One of those communities doesn’t exist.");
  return slugs;
}
