import { MediaGallery } from "@/components/media/media-gallery";
import { getMediaOrigin } from "@/lib/media/reading-policy.server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import { ArrowLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import { getEntry } from "@/lib/api";
import { kindLabels } from "@/lib/data";
import { EntryActions } from "@/components/entry-actions";
import { OutcomeBadge } from "@/components/entry-card";
import { OutcomeGlyph } from "@/components/glyph";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const entry = await getEntry((await params).id);
  return {
    title: entry?.title ?? "Field note not found",
    description: entry?.excerpt,
  };
}
export default async function EntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const entry = await getEntry((await params).id);
  if (!entry) notFound();
  const contextRows = Object.entries(entry.context);
  return (
    <div className="dossier frame">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/#discover" className="back-link">
          <ArrowLeft size={14} /> All entries
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={`/?topic=${encodeURIComponent(entry.topic)}#discover`}>
          {entry.topic}
        </Link>
        <span aria-hidden="true">/</span>
        <span>{kindLabels[entry.kind]}</span>
      </nav>
      {entry.example && (
        <div className="sample-banner">
          <span className="example-tag">Sample data</span>
          <p>
            <strong>A fictional field note.</strong> This story and its evidence
            are examples of how Unstuck works.
          </p>
        </div>
      )}
      {entry.highStakes && (
        <div className="safety-banner">
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>A topic that deserves extra care.</strong>
            <p>
              Shared experiences are not professional advice. Consider the risks
              and consult a qualified professional.
            </p>
          </div>
        </div>
      )}
      <header className="dossier-head" data-outcome={entry.outcome ?? "open"}>
        <div className="dossier-verdict">
          <OutcomeGlyph outcome={entry.outcome ?? "open"} size={18} />
          <OutcomeBadge outcome={entry.outcome} />
        </div>
        <ViewTransition name={`title-${entry.id}`} share="morph" default="none">
          <h1>{entry.title}</h1>
        </ViewTransition>
        <p>{entry.excerpt}</p>
      </header>
      <dl className="readout readout-wide">
        <div>
          <dt>Tried it</dt>
          <dd>{entry.tried}</dd>
        </div>
        <div>
          <dt>Helped</dt>
          <dd>{entry.helped}</dd>
        </div>
        <div>
          <dt>Replies</dt>
          <dd>{entry.comments}</dd>
        </div>
        <div>
          <dt>Reading time</dt>
          <dd>
            {entry.readingMinutes}
            <small> min</small>
          </dd>
        </div>
        <div className="readout-text">
          <dt>Where</dt>
          <dd>{entry.place}</dd>
        </div>
        <div className="readout-text">
          <dt>Recorded by</dt>
          <dd>{entry.alias}</dd>
        </div>
      </dl>
      <div className="dossier-grid">
        <nav className="toc" aria-label="In this field note">
          <span className="label">Contents</span>
          {entry.sections.map((s, i) => (
            <a key={s.title} href={`#section-${i}`}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {s.title}
            </a>
          ))}
          <a href="#why">
            <span>{String(entry.sections.length + 1).padStart(2, "0")}</span>
            Why it happened
          </a>
        </nav>
        <article className="detail-story">
          <div className="story-body">
            {entry.sections.map((section, i) => (
              <section key={section.title} id={`section-${i}`}>
                <div className="story-number" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div>
                  <h2>{section.title}</h2>
                  <p>{section.body}</p>
                </div>
              </section>
            ))}
          </div>
          <MediaGallery
            attachments={entry.media ?? []}
            origin={getMediaOrigin()}
          />
          <p className="story-ending">
            One person’s experience, and a starting point for your own
            questions.
          </p>
          <EntryActions id={entry.id} />
          <section className="why-board" id="why">
            <div className="why-head">
              <h2>Why it happened</h2>
              <p>
                Possible explanations, grounded in what people observed. Support
                is evidence, not a vote.
              </p>
            </div>
            {entry.evidence.length ? (
              entry.evidence.map((evidence) => (
                <div
                  key={evidence.label}
                  className="evidence-row"
                  data-state={evidence.state}
                >
                  <span className="evidence-state">
                    <span className="evidence-dot" aria-hidden="true" />
                    {evidence.state}
                  </span>
                  <div>
                    <h3>{evidence.label}</h3>
                    <p>{evidence.detail}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="quiet-notice">
                No explanations have been published for this note yet.
              </p>
            )}
            <Link
              href={`/new?kind=experience&relates=${encodeURIComponent(entry.id)}`}
              className="text-link"
            >
              Bring another perspective <ArrowUpRight size={14} />
            </Link>
          </section>
        </article>
        <aside className="detail-aside">
          <div className="context-panel">
            <span className="label">Conditions</span>
            <h2>Would it work where you are?</h2>
            {contextRows.length ? (
              <dl>
                {contextRows.map(([key, value]) => (
                  <div key={key}>
                    <dt>{key.replaceAll("_", " ")}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>No conditions were recorded for this entry.</p>
            )}
            <p className="context-footnote">
              Different conditions can tell a different story.
            </p>
          </div>
          <Link
            className="detail-contribute"
            href={`/new?relates=${encodeURIComponent(entry.id)}`}
          >
            <span>Been somewhere similar?</span>
            <strong>
              Add your experience <ArrowUpRight size={15} />
            </strong>
          </Link>
          <p className="detail-license">
            {entry.example
              ? "Example field note."
              : `Shared under ${entry.license ?? "the author’s chosen license"}.`}{" "}
            Aliases change with every entry.
          </p>
        </aside>
      </div>
    </div>
  );
}
