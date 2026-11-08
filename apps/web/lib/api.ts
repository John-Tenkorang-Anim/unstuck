import "server-only";
import { examples } from "./data";
import type { Entry, Notebook, Topic } from "./types";

import type { EntryView as ApiEntry } from "./contracts/entry-v1";
import { summarizeEntry } from "./types";
import { parseEntry, parseFeed } from "./platform/contracts.server";
import { readJson, PlatformUnavailable } from "./platform/http";
import { publishedEntries, publishedEntry } from "./entries.server";
import { hasDatabase, showExamples } from "./db.server";
function adapt(entry: ApiEntry): Entry {
  const templateTopic: Record<string, Topic> = {
    farming_food: "Agriculture",
    making: "Engineering",
    software: "Technology",
    research: "Science",
    community: "Community",
  };
  return {
    id: entry.id,
    kind: entry.kind,
    title: entry.title,
    excerpt: entry.goal,
    topic: templateTopic[entry.template] ?? "Everyday life",
    outcome: entry.outcome,
    place:
      entry.context.region ?? entry.context.country ?? "Context shared inside",
    alias: entry.author.alias,
    date: entry.published_at ?? "",
    illustration: entry.template === "software" ? "code" : "garden",
    readingMinutes: Math.max(
      1,
      Math.ceil(
        [entry.goal, entry.approach, entry.result].join(" ").split(" ").length /
          200,
      ),
    ),
    tried:
      entry.stats.same_count +
      entry.stats.not_same_count +
      entry.stats.worked_count +
      entry.stats.didnt_work_count +
      entry.stats.solved_for_count,
    helped: entry.stats.helped_count + entry.stats.saved_count,
    comments: entry.stats.comment_count,
    context: entry.context,
    sections: [
      { title: "What I was trying to do", body: entry.goal },
      { title: "What I tried", body: entry.approach ?? "" },
      { title: "What happened", body: entry.result ?? "" },
      { title: "My best explanation", body: entry.why_text ?? "" },
      { title: "What I would do differently", body: entry.advice ?? "" },
    ].filter((s) => s.body),
    evidence: [],
    links: entry.links.map((link) => ({
      label: link.note ?? link.rel.replaceAll("_", " "),
      url: `/entries/${link.to_id}`,
    })),
    problem: entry.links.find((link) => link.rel === "solves")?.to_id,
    example: false,
    highStakes: entry.high_stakes,
    license: entry.license,
  };
}
/** Published field notes come first, then the API's feed or the samples. */
export async function getNotebook(): Promise<Notebook> {
  const published = (await publishedEntries()).map(summarizeEntry);
  const notebook = await getFeed();
  const seen = new Set(published.map((e) => e.id));
  const entries = [
    ...published,
    ...notebook.entries.filter((e) => !seen.has(e.id)),
  ];
  if (showExamples()) for (const example of examples) if (!entries.some((e) => e.id === example.id)) entries.push(summarizeEntry(example));
  return {
    entries,
    mode:
      notebook.mode === 'unavailable' ? 'unavailable' : entries.some((e) => e.example) && entries.some((e) => !e.example) ? 'mixed' : notebook.mode,
  };
}
async function getFeed(): Promise<Notebook> {
  const base = process.env.UNSTUCK_API_URL;
  if (!base)
    return showExamples()
      ? { entries: examples.map(summarizeEntry), mode: "examples" }
      : { entries: [], mode: hasDatabase() ? "live" : "examples" };
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}/feed`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("API unavailable");
    const entries = parseFeed(await readJson(response, 2 * 1024 * 1024));
    return {
      entries: entries.map((item) => summarizeEntry(adapt(item.record))),
      mode: "live",
    };
  } catch {
    return { entries: [], mode: "unavailable" };
  }
}
export async function getEntry(id: string): Promise<Entry | undefined> {
  const published = await publishedEntry(id);
  if (published) return published;
  const sample = showExamples() ? examples.find((entry) => entry.id === id) : undefined;
  if (sample) return sample;
  const base = process.env.UNSTUCK_API_URL;
  if (!base) return undefined;
  try {
    const response = await fetch(
      `${base.replace(/\/$/, "")}/entries/${encodeURIComponent(id)}`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
    if (response.status === 404) return undefined;
    if (!response.ok) throw new PlatformUnavailable();
    const item = parseEntry(await readJson(response, 512 * 1024));
    return { ...adapt(item.record), media: item.attachments };
  } catch {
    throw new PlatformUnavailable();
  }
}
