import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Route } from "lucide-react";
import { Tabs } from "@/components/knowledge";
import { SavedList } from "@/components/saved-list";
import { showExamples } from "@/lib/db.server";
import {
  collections as sampleCollections,
  guides as sampleGuides,
  patterns as samplePatterns,
} from "@/lib/lessons";
import { catalog } from "@/lib/refs.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lessons" };
const tabs = [
  ["patterns", "Patterns"],
  ["guides", "Guides"],
  ["collections", "Collections"],
  ["saved", "Saved"],
] as const;
type Tab = (typeof tabs)[number][0];

/**
 * The Lessons library organises knowledge derived from records. Discover finds
 * records; this carries what they teach forward, always citing where from.
 */
export default async function Lessons({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const tab = (tabs.find(([k]) => k === query.tab)?.[0] ?? "patterns") as Tab;
  const refs = await catalog();
  const patterns = showExamples() ? samplePatterns : [],
    guides = showExamples() ? sampleGuides : [],
    collections = showExamples() ? sampleCollections : [];
  const topics = [
    ...new Set([...patterns, ...guides].flatMap((x) => x.categories)),
  ].sort();
  const topic = typeof query.topic === "string" ? query.topic : "";
  const inTopic = <T extends { categories: string[] }>(xs: T[]) =>
    topic ? xs.filter((x) => x.categories.includes(topic)) : xs;
  const href = (k: string, t = topic) => {
    const p = new URLSearchParams({
      ...(k !== "patterns" ? { tab: k } : {}),
      ...(t ? { topic: t } : {}),
    });
    return `/lessons${p.size ? `?${p}` : ""}`;
  };
  return (
    <div className="frame directory lessons-page">
      <header className="editorial-head">
        <div>
          <h1>Knowledge worth carrying forward.</h1>
          <p>
            Patterns across many attempts, practical guides, and curated
            collections. Each one cites its records.
          </p>
        </div>
      </header>
      {tab !== "saved" && tab !== "collections" && (
        <nav className="dv-categories" aria-label="Topics">
          <Link href={href(tab, "")} aria-current={!topic ? "true" : undefined}>
            All topics
          </Link>
          {topics.map((t) => (
            <Link
              key={t}
              href={href(tab, t)}
              aria-current={topic === t ? "true" : undefined}
            >
              {t}
            </Link>
          ))}
        </nav>
      )}
      <Tabs label="Lessons" current={tab} href={(k) => href(k)} tabs={tabs} />

      {tab !== "saved" && showExamples() && (
        <p className="example-notice">
          <span className="example-tag">Sample library</span> Illustrative
          patterns and guides, built from sample records.
        </p>
      )}
      {((tab === "patterns" && !inTopic(patterns).length) ||
        (tab === "guides" && !inTopic(guides).length) ||
        (tab === "collections" && !collections.length)) && (
        <p className="empty-state">
          No {tab} in this selection yet.{" "}
          <Link className="text-link" href="/discover?tab=lessons">
            Read lessons from published attempts
          </Link>
        </p>
      )}
      {tab === "patterns" && (
        <ul className="lib-grid">
          {inTopic(patterns).map((p) => (
            <li key={p.id}>
              <Link className="lib-card" href={`/lessons/${p.id}`}>
                <span className="claim-kind">
                  Pattern · {p.supporting.length}{" "}
                  {p.supporting.length === 1 ? "record" : "records"}
                </span>
                <strong>{p.title}</strong>
                <small>{p.scope}</small>
                {p.counterexamples.length > 0 && (
                  <span className="lib-counter">
                    {p.counterexamples.length} counterexample
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {tab === "guides" && (
        <ul className="lib-grid">
          {inTopic(guides).map((g) => (
            <li key={g.id}>
              <Link className="lib-card" href={`/lessons/${g.id}`}>
                <span className="claim-kind">
                  <Route size={12} aria-hidden="true" /> Learning path ·{" "}
                  {g.steps.length} steps
                </span>
                <strong>{g.title}</strong>
                <small>{g.summary}</small>
                <span className="record-meta">By {g.author}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {tab === "collections" && (
        <ul className="lib-collections">
          {collections.map((c) => (
            <li key={c.id}>
              <div className="dv-section-head">
                <h2>{c.title}</h2>
                <span className="record-meta">Curated by {c.curator}</span>
              </div>
              <ul className="row-list">
                {c.items
                  .filter((i) => refs[i])
                  .map((i) => (
                    <li key={i}>
                      <Link href={refs[i].href}>{refs[i].label}</Link>
                      <span className="record-meta">{refs[i].kind}</span>
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {tab === "saved" && (
        <section className="dv-section">
          <SavedList
            catalog={refs}
            empty="Nothing saved yet. Save lessons, problems and attempts as you read, and they’ll appear here."
          />
          <Link className="text-link" href="/discover?tab=lessons">
            Browse lessons <ArrowRight size={13} />
          </Link>
        </section>
      )}
    </div>
  );
}
