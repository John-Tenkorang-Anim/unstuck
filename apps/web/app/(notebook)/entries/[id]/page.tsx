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
import { MomentPlayer } from "@/components/moment-player";
import { Picture } from "@/components/picture";
import { sampleSessions } from "@/lib/sessions";
import { ReportButton } from "@/components/report-button";
import { Discussion } from "@/components/discussion";
import { EntryLayout } from "@/components/entry-layout";
import { listCommunities } from "@/lib/communities.server";
import { sampleCommunities, type Community } from "@/lib/communities";
import { currentAccount, publicAccount } from "@/lib/auth.server";
import { hasDatabase } from "@/lib/db.server";
import {
  discussionSummary,
  listComments,
  ownerInsights,
} from "@/lib/discussion.server";
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const entry = await getEntry((await params).id);
  if (!entry) notFound();
  const query = await searchParams;
  const t = Number(query.t);
  const start = Number.isFinite(t) && t >= 0 ? t : undefined;
  const viewer = await currentAccount();
  const isOwner = !!viewer && !!entry.owner && viewer.id === entry.owner;
  const [summary, firstPage, insights] = await Promise.all([
    discussionSummary(entry),
    listComments(entry.id, { viewer: viewer?.id }).catch(() => ({
      items: [],
      next: null,
      count: 0,
    })),
    isOwner && viewer
      ? ownerInsights(viewer, entry.id)
      : Promise.resolve(undefined),
  ]);
  const sessions = entry.example
    ? sampleSessions.filter((session) => session.entryId === entry.id)
    : [];
  const contextRows = Object.entries(entry.context);
  const all = await listCommunities().catch(() => sampleCommunities);
  const postedTo = (entry.communities ?? [])
    .map((slug) => all.find((c) => c.slug === slug))
    .filter((c): c is Community => !!c);
  return (
    <EntryLayout
      initialOpen={query.discuss === "1"}
      title={entry.title}
      stats={{
        responses: summary.total,
        explanations: summary.explanations.length,
        unanswered: summary.unanswered,
        fresh: insights?.responses,
      }}
      discussion={
        <Discussion
          entryId={entry.id}
          summary={summary}
          first={firstPage}
          viewer={publicAccount(viewer)}
          isOwner={isOwner}
          insights={insights}
          enabled={hasDatabase()}
        />
      }
    >
      <div className="dossier frame">
        <nav className="crumbs" aria-label="Breadcrumb">
          {postedTo[0] ? (
            <Link
              href={`/communities/${postedTo[0].slug}`}
              className="back-link"
            >
              <ArrowLeft size={14} /> {postedTo[0].name}
            </Link>
          ) : (
            <Link href="/discover" className="back-link">
              <ArrowLeft size={14} /> Discover
            </Link>
          )}
          <span aria-hidden="true">/</span>
          <Link
            href={`/discover?topic=${encodeURIComponent(entry.topic)}#discover`}
          >
            {entry.topic}
          </Link>
          <span aria-hidden="true">/</span>
          <span>{kindLabels[entry.kind]}</span>
        </nav>
        {entry.example && (
          <div className="sample-banner">
            <span className="example-tag">
              {entry.historical ? "Historical case" : "Sample data"}
            </span>
            <p>
              {entry.historical ? (
                <>
                  <strong>A documented failure, retold as an entry.</strong> The
                  film is public domain. The write-up shows how Unstuck presents
                  a case.
                </>
              ) : (
                <>
                  <strong>A fictional field note.</strong> This story and its
                  evidence are examples of how Unstuck works.
                </>
              )}
            </p>
          </div>
        )}
        {entry.hidden && (
          <p className="review-notice" role="status">
            This field note is hidden from everyone else.{" "}
            <Link className="text-link" href="/account#standing">
              See why, or appeal
            </Link>
          </p>
        )}
        {entry.highStakes && (
          <div className="safety-banner">
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>A topic that deserves extra care.</strong>
              <p>
                Shared experiences are not professional advice. Consider the
                risks and consult a qualified professional.
              </p>
            </div>
          </div>
        )}
        <header className="dossier-head" data-outcome={entry.outcome ?? "open"}>
          <div className="dossier-verdict">
            <OutcomeGlyph outcome={entry.outcome ?? "open"} size={18} />
            <OutcomeBadge outcome={entry.outcome} />
          </div>
          <ViewTransition
            name={`title-${entry.id}`}
            share="morph"
            default="none"
          >
            <h1>{entry.title}</h1>
          </ViewTransition>
          <p>{entry.excerpt}</p>
          {(postedTo.length > 0 || entry.public === false) && (
            <p className="posted-to">
              <span>
                {entry.public === false
                  ? "Shared only with"
                  : "Posted publicly and to"}
              </span>
              {postedTo.map((c) => (
                <Link key={c.slug} href={`/communities/${c.slug}`}>
                  {c.name}
                </Link>
              ))}
            </p>
          )}
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
          <article className="detail-story">
            {entry.clip ? (
              <MomentPlayer clip={entry.clip} start={start} />
            ) : (
              entry.cover && (
                <Picture
                  id="photo"
                  picture={entry.cover}
                  className="story-photo"
                  sizes="(max-width: 880px) 100vw, 660px"
                />
              )
            )}
            {entry.photos && entry.photos.length > 0 && (
              <div className="story-photos">
                {entry.photos.map((photo) => (
                  <Picture
                    key={photo.src}
                    picture={photo}
                    sizes="(max-width: 880px) 100vw, 660px"
                  />
                ))}
              </div>
            )}
            {entry.mediaState && entry.mediaState !== "ready" && (
              <p className="review-notice" role="status">
                {entry.mediaState === "pending"
                  ? "Your photos or video are waiting for a moderator. Everyone else will see them once approved."
                  : "Some photos or video are waiting for review."}
              </p>
            )}
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
            {sessions.map((session) => (
              <Link
                key={session.id}
                className="detail-session"
                href={`/sessions/${session.id}`}
              >
                <span>
                  Open inquiry · {session.rounds.flatMap((r) => r.notes).length}{" "}
                  notes
                </span>
                <strong>{session.title}</strong>
              </Link>
            ))}
            <Link
              className="detail-contribute"
              href={`/new?relates=${encodeURIComponent(entry.id)}`}
            >
              <span>Been somewhere similar?</span>
              <strong>
                Add your experience <ArrowUpRight size={15} />
              </strong>
            </Link>
            {entry.owner && <ReportButton type="entry" id={entry.id} />}
            <p className="detail-license">
              {entry.example
                ? "Example field note. Aliases change with every entry."
                : entry.owner
                  ? `Posted by ${entry.alias}. Shared under ${entry.license ?? "CC BY 4.0"}.`
                  : `Shared under ${entry.license ?? "the author’s chosen license"}. Aliases change with every entry.`}
            </p>
          </aside>
        </div>
      </div>
    </EntryLayout>
  );
}
