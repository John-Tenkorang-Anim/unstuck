import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Clock3,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import { getEntry } from "@/lib/api";
import { kindLabels } from "@/lib/data";
import { Artwork } from "@/components/artwork";
import { EntryActions } from "@/components/entry-actions";
import { OutcomeBadge } from "@/components/entry-card";
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
  return (
    <div className="page-container detail-container">
      <Link href="/#discover" className="back-link">
        <ArrowLeft size={15} /> Back to the open notebook
      </Link>
      {entry.example && (
        <div className="sample-banner">
          <BookOpen size={16} />
          <div>
            <strong>A fictional field note.</strong> This story and its evidence
            are examples of how Unstuck works.
          </div>
        </div>
      )}
      {entry.highStakes && (
        <div className="safety-banner">
          <ShieldCheck size={20} />
          <div>
            <strong>A topic that deserves extra care.</strong>
            <p>
              Shared experiences are not professional advice. Consider the risks
              and consult a qualified professional.
            </p>
          </div>
        </div>
      )}
      <div className="detail-heading">
        <div className="eyebrow">
          {entry.topic} <span> / </span> {kindLabels[entry.kind]}
        </div>
        <h1>{entry.title}</h1>
        <p>{entry.excerpt}</p>
        <div className="detail-meta">
          <span className="author-avatar">{entry.alias[0].toUpperCase()}</span>
          <span>
            <strong>{entry.alias}</strong>
            <small>A different alias. The same human curiosity.</small>
          </span>
          <span className="meta-spacer" />
          <span>
            <MapPin size={14} />
            {entry.place}
          </span>
          <span>
            <Clock3 size={14} />
            {entry.readingMinutes} min read
          </span>
        </div>
      </div>
      <div className="detail-layout">
        <article className="detail-story">
          <div className="detail-illustration">
            <Artwork type={entry.illustration} />
            <div className="detail-art-badge">
              <OutcomeBadge outcome={entry.outcome} />
            </div>
          </div>
          <div className="story-body">
            {entry.sections.map((section, i) => (
              <section key={section.title} id={`section-${i}`}>
                <div className="story-number">0{i + 1}</div>
                <div>
                  <h2>{section.title}</h2>
                  <p>{section.body}</p>
                </div>
              </section>
            ))}
          </div>
          <div className="story-ending">
            <span>✳</span>
            <p>
              One person’s experience.
              <br />
              <strong>A starting point for your own questions.</strong>
            </p>
          </div>
          <EntryActions id={entry.id} />
          <section className="why-board" id="why">
            <div className="section-kicker">THE WHY BOARD</div>
            <h2>
              The result is a beginning.
              <br />
              <em>Let’s understand the why.</em>
            </h2>
            <p className="section-description">
              Possible explanations, grounded in what people observed. Support
              is evidence, not a vote.
            </p>
            {entry.evidence.length ? (
              entry.evidence.map((evidence, i) => (
                <div key={evidence.label} className="evidence-row">
                  <span className="evidence-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>{evidence.label}</h3>
                    <p>{evidence.detail}</p>
                  </div>
                  <span className={`evidence-state state-${evidence.state}`}>
                    {evidence.state === "supported" && <Check size={12} />}
                    {evidence.state}
                  </span>
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
              Bring another perspective <ArrowUpRight size={15} />
            </Link>
          </section>
          <section className="discussion-invite">
            <MessageCircle size={25} />
            <div>
              <h3>The conversation is part of the knowledge.</h3>
              <p>
                A careful question, a different context, or a result of your own
                can move the story forward.
              </p>
              <Link
                href={`/new?relates=${encodeURIComponent(entry.id)}`}
                className="text-link"
              >
                Start a related field note <ArrowRight size={15} />
              </Link>
            </div>
          </section>
        </article>
        <aside className="detail-aside">
          <div className="context-panel">
            <Sprout size={22} />
            <span className="section-kicker">CONTEXT IS EVERYTHING</span>
            <h2>
              Would it work
              <br />
              <em>where you are?</em>
            </h2>
            <p>A result makes more sense when you know where it came from.</p>
            <dl>
              {Object.entries(entry.context).map(([key, value]) => (
                <div key={key}>
                  <dt>{key.replaceAll("_", " ")}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="context-footnote">
              Different conditions can tell a different story.
            </div>
          </div>
          <div className="toc">
            <span className="sidebar-label">IN THIS FIELD NOTE</span>
            {entry.sections.map((s, i) => (
              <a key={s.title} href={`#section-${i}`}>
                <span>0{i + 1}</span>
                {s.title}
              </a>
            ))}
            <a href="#why">
              <span>↗</span>The Why board
            </a>
          </div>
          <div className="detail-contribute">
            <span>Been somewhere similar?</span>
            <Link href={`/new?relates=${encodeURIComponent(entry.id)}`}>
              Your experience belongs here. <ArrowUpRight size={18} />
            </Link>
          </div>
        </aside>
      </div>
      <footer className="page-footer">
        <span>
          {entry.example
            ? "Example field note · Keep curiosity moving."
            : `Shared under ${entry.license ?? "the author’s chosen license"} · Keep knowledge moving.`}
        </span>
        <Link href="/about">
          Our principles <ArrowUpRight size={12} />
        </Link>
      </footer>
    </div>
  );
}
