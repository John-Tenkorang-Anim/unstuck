import "server-only";
import { currentAccount } from "./auth.server";
import { hasDatabase, query } from "./db.server";
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
} from "./store.server";
import { communityBySlug } from "./communities.server";
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
};
type StoredEntry = Entry & { files?: StoredMedia[]; hidden?: boolean };

const topicFor: Record<string, Topic> = {
  everyday: "Everyday life",
  making: "Making & fixing",
  farming_food: "Food & farming",
  software: "Software",
  research: "Research",
  work_business: "Everyday life",
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

/** Build a field note from the composer's form and its uploaded files. */
export async function createEntry(
  owner: { id: string; name: string },
  form: FormData,
) {
  const input = JSON.parse(String(form.get("entry") ?? "{}")) as Record<
    string,
    string
  >;
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
  const raw = input as Record<string, unknown>;
  const communities = await knownCommunities(raw.communities);
  const everyone = raw.public !== false;
  if (!everyone && !communities.length)
    throw new StoreError(
      "Choose where this should appear: everyone, a community, or both.",
    );
  const media = JSON.parse(String(form.get("media") ?? "[]")) as Record<
    string,
    unknown
  >[];
  if (!Array.isArray(media) || media.length > 9)
    throw new StoreError("Too many attachments.");
  const files: StoredMedia[] = [];
  for (const [index, meta] of media.entries()) {
    const upload = form.get(`file-${index}`);
    if (!(upload instanceof File) || !upload.size) continue;
    const alt = clean.text(meta.alt, 3, 300, "Each attachment’s description");
    const { file, kind: fileKind } = await saveFile(
      owner.id,
      upload.name,
      Buffer.from(await upload.arrayBuffer()),
    );
    if (fileKind === "video" && files.some((f) => f.kind === "video"))
      throw new StoreError("One video per note.");
    files.push({
      file: file.id,
      kind: fileKind,
      alt,
      ...(fileKind === "image" && Number(meta.width) > 0
        ? {
            width: Math.round(Number(meta.width)),
            height: Math.round(Number(meta.height)),
            pins: cleanPins(meta.pins),
          }
        : {}),
      ...(fileKind === "video"
        ? {
            duration: Number(meta.duration) || undefined,
            moments: cleanMoments(meta.moments),
          }
        : {}),
    });
  }
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
  const words = sections
    .map((s) => s.body)
    .join(" ")
    .split(/\s+/).length;
  const entry: StoredEntry = {
    id: newId(),
    kind,
    title,
    excerpt: goal.length > 220 ? `${goal.slice(0, 217)}…` : goal,
    topic: topicFor[template],
    outcome,
    place: country || "Not specified",
    alias: owner.name,
    date: new Date().toISOString().slice(0, 10),
    illustration: "garden",
    readingMinutes: Math.max(1, Math.ceil(words / 200)),
    tried: 0,
    helped: 0,
    comments: 0,
    context: country ? { Country: country } : {},
    sections,
    evidence: [],
    example: false,
    license: "CC BY 4.0",
    owner: owner.id,
    files,
    communities,
    public: everyone,
  };
  await insertEntry(entry, owner.id);
  return entry.id;
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
          poster: pictures[0],
        }
      : undefined,
    mediaState: anyPending ? (privileged ? "pending" : "held") : "ready",
  };
}
/** Published field notes for the public feed and search. Community-only posts stay out. */
export async function publishedEntries(): Promise<Entry[]> {
  if (!hasDatabase()) return [];
  try {
    const entries = ((await storedEntries()) as StoredEntry[]).filter(
      (e) => e.public !== false,
    );
    return Promise.all(entries.map((e) => present(e)));
  } catch (error) {
    console.error("Published field notes are unavailable", error);
    return [];
  }
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
