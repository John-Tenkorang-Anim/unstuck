import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RailBlock } from "@/components/knowledge";
import { CiteAction } from "@/components/record-actions";
import { guides, patterns } from "@/lib/lessons";
import { showExamples } from "@/lib/db.server";
import { catalog } from "@/lib/refs.server";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return {
    title: [...patterns, ...guides].find((x) => x.id === id)?.title ?? "Lesson",
  };
}

/** A pattern with its scope, records, counterexamples and limits, or a guide. */
export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!showExamples()) notFound();
  const pattern = patterns.find((p) => p.id === id);
  const guide = guides.find((g) => g.id === id);
  if (!pattern && !guide) notFound();
  const refs = await catalog();
  const link = (r: string) =>
    refs[r] ? (
      <Link key={r} href={refs[r].href}>
        {refs[r].label}
      </Link>
    ) : null;
  return (
    <div className="frame knowledge-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link
          href={guide ? "/lessons?tab=guides" : "/lessons"}
          className="back-link"
        >
          <ArrowLeft size={14} /> Lessons
        </Link>
      </nav>
      <p className="example-notice">
        <span className="example-tag">Sample data</span> Built from the sample
        records.
      </p>
      <header className="record-head">
        <p className="record-kicker">
          {pattern ? "Pattern" : "Guide · learning path"}
        </p>
        <h1>{(pattern ?? guide)!.title}</h1>
        <p className="record-lede">{pattern?.summary ?? guide?.summary}</p>
        <div className="record-actions-row">
          <CiteAction
            cite={{
              title: (pattern ?? guide)!.title,
              author: guide?.author ?? "Unstuck contributors",
              date: "2026-11-08",
              path: `/lessons/${id}`,
              kind: pattern ? "Pattern" : "Guide",
            }}
          />
        </div>
      </header>
      <div className="knowledge-grid knowledge-grid-two">
        <div className="knowledge-main">
          {pattern && (
            <>
              <section className="prose-block">
                <h2>Supporting records</h2>
                <ul className="row-list">
                  {pattern.supporting.map((r) =>
                    refs[r] ? (
                      <li key={r}>
                        {link(r)}
                        <span className="record-meta">{refs[r].kind}</span>
                      </li>
                    ) : null,
                  )}
                </ul>
              </section>
              <section className="prose-block">
                <h2>Counterexamples</h2>
                {pattern.counterexamples.length ? (
                  <ul className="claims">
                    {pattern.counterexamples.map((c, i) => (
                      <li key={i} data-kind="hypothesis">
                        <p>{c.text}</p>
                        {c.ref && (
                          <p className="claim-refs">From {link(c.ref)}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="quiet-line">
                    None recorded yet. Know one? Share it as an attempt.
                  </p>
                )}
              </section>
              <section className="prose-block">
                <h2>Limitations</h2>
                <p>{pattern.limitations}</p>
                <p className="aside-note">
                  A pattern is an observation across records. It isn’t proof
                  that one thing causes another.
                </p>
              </section>
            </>
          )}
          {guide && (
            <ol className="path">
              {guide.steps.map((s, i) => (
                <li key={i}>
                  <span className="path-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div>
                    <h2>{s.title}</h2>
                    <p>{s.body}</p>
                    <p className="claim-refs">
                      From{" "}
                      {s.refs.map((r, n) => (
                        <span key={r}>
                          {n > 0 && ", "}
                          {link(r)}
                        </span>
                      ))}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
        <aside className="knowledge-rail">
          <RailBlock title="Scope">
            <p className="rail-text">
              {pattern?.scope ??
                `${guide!.steps.length} steps, each linked to real records.`}
            </p>
          </RailBlock>
          <RailBlock title="Topics">
            <p className="rail-text">
              {(pattern ?? guide)!.categories.join(", ")}
            </p>
          </RailBlock>
        </aside>
      </div>
    </div>
  );
}
