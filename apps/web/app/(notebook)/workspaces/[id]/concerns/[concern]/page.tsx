import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  MapPin,
} from "lucide-react";
import {
  CompleteCommitment,
  ConcernForm,
  SupportConcern,
} from "@/components/concern-actions";
import { Pill, RailBlock } from "@/components/knowledge";
import { CiteAction } from "@/components/record-actions";
import { ReportButton } from "@/components/report-button";
import { currentAccount } from "@/lib/auth.server";
import {
  concernReference,
  concernStatus,
  concernTone,
  eventLabel,
  isOverdue,
  type ConcernStatus,
} from "@/lib/concerns";
import {
  commitmentsFor,
  concernEvents,
  getConcern,
} from "@/lib/concerns.server";
import { atLeast, getWorkspace } from "@/lib/workspaces.server";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string; concern: string }> };
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id, concern } = await params;
  const c = await getConcern(id, concern, await currentAccount());
  return {
    title: c ? `${concernReference(c.number)} · ${c.title}` : "Concern",
  };
}
const track: ConcernStatus[] = [
  "open",
  "acknowledged",
  "in_progress",
  "resolved",
];
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/**
 * One community concern: what is happening, what change is asked for, who
 * committed to what by when, and an append-only record of everything since.
 */
export default async function ConcernPage({
  params,
  searchParams,
}: Params & {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id, concern } = await params;
  const query = await searchParams;
  const viewer = await currentAccount();
  const [found, c] = await Promise.all([
    getWorkspace(id, viewer),
    getConcern(id, concern, viewer),
  ]);
  if (!found || !c) notFound();
  const { workspace: w, role } = found;
  const before = typeof query.before === "string" ? query.before : undefined;
  const [journal, commitments] = await Promise.all([
    concernEvents(id, concern, viewer, before),
    commitmentsFor(id, concern, viewer),
  ]);
  const step = track.indexOf(c.status);
  const canContribute =
    !w.sample &&
    !!viewer &&
    (atLeast(role, "contributor") || w.visibility === "public");
  const canSteer = !w.sample && atLeast(role, "editor");
  const ref = concernReference(c.number);
  return (
    <div className="frame knowledge-page concern-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href={`/workspaces/${w.id}?tab=concerns`} className="back-link">
          <ArrowLeft size={14} /> {w.title}
        </Link>
      </nav>
      {w.sample && (
        <p className="example-notice">
          <span className="example-tag">Sample data</span> An illustrative
          concern. Organisations and links are made up.
        </p>
      )}
      <header className="record-head concern-head">
        <p className="record-kicker">
          <span className="concern-ref">{ref}</span> · {c.topic}
          {c.place && (
            <>
              {" · "}
              <MapPin size={12} aria-hidden="true" /> {c.place}
            </>
          )}
        </p>
        <h1>{c.title}</h1>
        <div className="record-status">
          <Pill tone={concernTone[c.status]}>{concernStatus[c.status]}</Pill>
          {c.overdue > 0 && (
            <Pill tone="failed">
              {c.overdue} overdue{" "}
              {c.overdue === 1 ? "commitment" : "commitments"}
            </Pill>
          )}
          <span className="record-meta">
            Raised by{" "}
            {c.authorHandle.startsWith("p_") ? (
              <Link href={`/people/${c.authorHandle}`}>{c.author}</Link>
            ) : (
              <b>{c.author}</b>
            )}{" "}
            on {day(c.created)}
          </span>
        </div>
        <div className="concern-top">
          <SupportConcern
            workspace={w.id}
            concern={c.id}
            supporters={c.supporters}
            supporting={c.supporting}
            sample={w.sample}
          />
          <CiteAction
            cite={{
              title: `${ref}: ${c.title}`,
              author: c.author,
              date: c.created,
              path: `/workspaces/${w.id}/concerns/${c.id}`,
              kind: "Community concern",
            }}
          />
        </div>
      </header>

      <ol className="lifecycle concern-track" aria-label="Status">
        {track.map((s, n) => (
          <li
            key={s}
            data-state={n < step ? "done" : n === step ? "current" : "next"}
            aria-current={n === step ? "step" : undefined}
          >
            <span>{concernStatus[s]}</span>
          </li>
        ))}
      </ol>

      <div className="knowledge-grid knowledge-grid-two">
        <div className="knowledge-main">
          <section className="ask-box">
            <span className="label">What we’re asking for</span>
            <p>{c.requestedAction}</p>
          </section>
          <section className="prose-block">
            <h2>What is happening</h2>
            <p className="concern-body">{c.body}</p>
          </section>

          {commitments.length > 0 && (
            <section className="prose-block">
              <h2>Commitments</h2>
              <ul className="commitments">
                {commitments.map((k) => {
                  const late = !k.completed && isOverdue(k.due);
                  return (
                    <li
                      key={k.id}
                      data-state={k.completed ? "done" : late ? "late" : "due"}
                    >
                      {k.completed ? (
                        <CheckCircle2 size={18} aria-hidden="true" />
                      ) : (
                        <CalendarClock size={18} aria-hidden="true" />
                      )}
                      <div>
                        <strong>{k.title}</strong>
                        <p className="record-meta">
                          {k.responsible} · due {day(k.due)}
                          {k.completed
                            ? ` · done ${day(k.completed)}`
                            : late
                              ? " · overdue"
                              : ""}
                        </p>
                      </div>
                      {!k.completed && k.canComplete && !w.sample && (
                        <CompleteCommitment
                          workspace={w.id}
                          concern={c.id}
                          commitment={k.id}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="prose-block">
            <h2>The record</h2>
            <p className="quiet-line">
              Every update, newest first. Updates are added, never rewritten.
            </p>
            <ol className="journal">
              {journal.items.map((e) => (
                <li key={e.id} data-kind={e.kind}>
                  <span className="journal-dot" aria-hidden="true" />
                  <div>
                    <p className="thread-meta">
                      <span className="kind-tag" data-kind={e.kind}>
                        {eventLabel[e.kind]}
                      </span>
                      <b>{e.author}</b>
                      {e.data.organization && (
                        <span className="record-meta">
                          {e.data.mode === "recorded" ? "recording" : "for"}{" "}
                          {e.data.organization}
                        </span>
                      )}
                      <time dateTime={e.created}>{day(e.created)}</time>
                    </p>
                    {e.kind === "status" && e.data.from && e.data.to && (
                      <p className="journal-status">
                        {concernStatus[e.data.from]} →{" "}
                        <b>{concernStatus[e.data.to]}</b>
                      </p>
                    )}
                    {e.kind === "commitment" && e.data.due && (
                      <p className="journal-status">
                        {e.data.responsible} · by {day(e.data.due)}
                      </p>
                    )}
                    <p>{e.body}</p>
                    {e.data.source && (
                      <a
                        className="source-link"
                        href={e.data.source}
                        rel="noopener noreferrer nofollow"
                        target={
                          e.data.source.startsWith("/") ? undefined : "_blank"
                        }
                      >
                        Source <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {journal.next && (
              <Link
                className="text-link"
                href={`/workspaces/${w.id}/concerns/${c.id}?before=${journal.next}`}
              >
                Older updates
              </Link>
            )}
          </section>

          <section className="prose-block" id="contribute">
            <h2>Add to the record</h2>
            {w.sample ? (
              <p className="aside-note">
                This is sample data, so it can’t take updates.
              </p>
            ) : !viewer ? (
              <p className="quiet-line">
                <Link
                  className="text-link"
                  href={`/account?next=${encodeURIComponent(`/workspaces/${w.id}/concerns/${c.id}`)}`}
                >
                  Choose a name
                </Link>{" "}
                to add context, evidence or a response.
              </p>
            ) : canContribute ? (
              <ConcernForm
                workspace={w.id}
                concern={c.id}
                status={c.status}
                version={c.version}
                canSteer={canSteer}
              />
            ) : (
              <p className="quiet-line">
                Viewers can read this record. Ask the workspace owner for
                contributor access.
              </p>
            )}
          </section>
        </div>

        <aside className="knowledge-rail">
          <RailBlock title="At a glance">
            <dl className="glance">
              <div>
                <dt>Affected neighbours</dt>
                <dd>{c.supporters}</dd>
              </div>
              <div>
                <dt>Responses</dt>
                <dd>{c.responses}</dd>
              </div>
              <div>
                <dt>Commitments</dt>
                <dd>{commitments.length}</dd>
              </div>
            </dl>
            <p className="rail-text quiet-line">
              Last updated {day(c.updated)}
            </p>
          </RailBlock>
          <RailBlock title="Workspace">
            <Link className="rail-link" href={`/workspaces/${w.id}`}>
              {w.title}
            </Link>
            {w.rules && <p className="rail-text">{w.rules}</p>}
          </RailBlock>
          <RailBlock title="How this works">
            <p className="rail-text">
              Anyone can read the record. Contributors add context and evidence;
              responses and commitments say who said them and link the source.
              Resolving needs proof residents can check.
            </p>
          </RailBlock>
          {!w.sample && <ReportButton type="concern" id={c.id} />}
        </aside>
      </div>
    </div>
  );
}
