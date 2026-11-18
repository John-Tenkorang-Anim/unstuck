import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  GraduationCap,
  HeartHandshake,
  Route,
  Target,
} from "lucide-react";
import { CloseRequest, OfferControls } from "@/components/help-actions";
import { Pill, RailBlock } from "@/components/knowledge";
import { PostForm } from "@/components/record-actions";
import { ReportButton } from "@/components/report-button";
import { getEntry } from "@/lib/api";
import { currentAccount } from "@/lib/auth.server";
import {
  audienceLabel,
  helpKinds,
  helpLabel,
  helpStatusLabel,
  offerLabel,
} from "@/lib/help";
import { getHelp } from "@/lib/help.server";
import { getProblem } from "@/lib/problems.server";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const r = await getHelp((await params).id);
  return { title: r?.title ?? "Help request" };
}
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** One request for help, the offers it received, and who it helped. */
export default async function HelpRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await currentAccount();
  const r = await getHelp((await params).id, viewer);
  if (!r) notFound();
  const [problem, entry] = await Promise.all([
    r.problemId ? getProblem(r.problemId) : undefined,
    r.entryId ? getEntry(r.entryId).catch(() => undefined) : undefined,
  ]);
  const mine = !!viewer && viewer.id === r.owner;
  const offered = !!viewer && r.offers.some((o) => o.owner === viewer.id);
  const person = (name: string, handle?: string) =>
    handle ? <Link href={`/people/${handle}`}>{name}</Link> : <b>{name}</b>;
  return (
    <div className="frame knowledge-page help-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/help" className="back-link">
          <ArrowLeft size={14} /> Get help
        </Link>
      </nav>
      {r.sample && (
        <p className="example-notice">
          <span className="example-tag">Sample data</span> An illustrative
          request.
        </p>
      )}
      <header className="record-head">
        <p className="record-kicker">
          {helpLabel[r.kind]} · {audienceLabel[r.audience]}
          {r.category && ` · ${r.category}`}
        </p>
        <h1>{r.title}</h1>
        <div className="record-status">
          <Pill
            tone={
              r.status === "helped"
                ? "worked"
                : r.status === "open"
                  ? "ongoing"
                  : "quiet"
            }
          >
            {helpStatusLabel[r.status]}
          </Pill>
          <span className="record-meta">
            Asked by {person(r.author, r.authorHandle)} on {day(r.created)}
          </span>
          {mine && !r.sample && (
            <CloseRequest request={r.id} open={r.status === "open"} />
          )}
        </div>
      </header>

      <div className="knowledge-grid knowledge-grid-two">
        <div className="knowledge-main">
          {r.graded && (
            <p className="graded-note">
              <GraduationCap size={18} aria-hidden="true" />
              <span>
                <b>This is for graded work.</b> Please give hints, questions and
                pointers, not the answer. Helping someone find it themselves
                counts as helping.
              </span>
            </p>
          )}
          <section className="prose-block">
            <p className="concern-body">{r.body}</p>
            {(problem || entry) && (
              <p className="record-links">
                <span>About</span>
                {problem && (
                  <Link href={`/problems/${problem.id}`}>
                    <Target size={13} aria-hidden="true" /> {problem.title}
                  </Link>
                )}
                {entry && (
                  <Link href={`/entries/${entry.id}`}>{entry.title}</Link>
                )}
              </p>
            )}
          </section>

          <section className="prose-block" aria-labelledby="offers-title">
            <h2 id="offers-title">
              {r.offers.length
                ? `${r.offers.length} ${r.offers.length === 1 ? "offer" : "offers"} of help`
                : "No offers yet"}
            </h2>
            {mine && r.status === "open" && r.offers.length === 0 && (
              <ol className="next-steps" aria-label="What happens next">
                <li data-done>
                  <b>Sent.</b> Your request went to {r.routed}{" "}
                  {r.routed === 1 ? "person" : "people"} who’ve faced something
                  similar.
                </li>
                <li>
                  <b>Offers arrive here</b> and in Activity. Accept the ones you
                  want.
                </li>
                <li>
                  <b>Say what helped</b> so the helper gets the credit.
                </li>
              </ol>
            )}
            <ol className="offers">
              {r.offers.map((o) => (
                <li
                  key={o.id}
                  id={`offer-${o.id}`}
                  data-helped={o.helped || undefined}
                  data-status={o.status}
                >
                  <span className="avatar" aria-hidden="true">
                    {o.author.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <p className="thread-meta">
                      {person(o.author, o.authorHandle)}
                      <time dateTime={o.created}>{day(o.created)}</time>
                      {o.helped ? (
                        <Pill tone="worked">
                          <HeartHandshake size={12} aria-hidden="true" /> Helped
                        </Pill>
                      ) : o.status === "accepted" ? (
                        <Pill tone="ongoing">Accepted</Pill>
                      ) : o.status === "declined" ? (
                        <Pill tone="quiet">Not this time</Pill>
                      ) : null}
                    </p>
                    <p>{o.body}</p>
                    {mine && !r.sample && (
                      <OfferControls
                        request={r.id}
                        offer={o.id}
                        status={o.status}
                        helped={o.helped}
                      />
                    )}
                    {!mine && viewer && o.owner !== viewer.id && !r.sample && (
                      <ReportButton type="help_offer" id={o.id} />
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {r.status === "open" && !mine && (
              <div className="raise" id="offer">
                <h3>
                  <HeartHandshake size={16} aria-hidden="true" />{" "}
                  {offerLabel[r.kind]}
                </h3>
                {r.sample ? (
                  <p className="quiet-line">
                    This is sample data, so it can’t take offers.
                  </p>
                ) : offered ? (
                  <p className="quiet-line">
                    You’ve offered to help. The asker will see it.
                  </p>
                ) : !viewer ? (
                  <p className="quiet-line">
                    <Link
                      className="text-link"
                      href={`/account?next=${encodeURIComponent(`/help/${r.id}`)}`}
                    >
                      Choose a name
                    </Link>{" "}
                    to offer help.
                  </p>
                ) : (
                  <PostForm
                    endpoint={`/api/help/${r.id}`}
                    extra={{ action: "offer" }}
                    submit="Send offer"
                    done="Offer sent."
                  >
                    <label className="field">
                      <span className="sr-only">Your offer</span>
                      <textarea
                        name="body"
                        rows={4}
                        required
                        minLength={10}
                        placeholder={
                          r.graded
                            ? "A hint or a question that points the way, without giving the answer."
                            : helpKinds.find((k) => k.key === r.kind)?.key ===
                                "partner"
                              ? "What you can run, where and when."
                              : "What you know, what you’ve tried, or what you can offer."
                        }
                      />
                    </label>
                  </PostForm>
                )}
              </div>
            )}
          </section>
        </div>
        <aside className="knowledge-rail">
          <RailBlock title="Who it reached">
            <p className="rail-text">
              <Route size={14} aria-hidden="true" /> Sent to {r.routed} people
              who follow the problem or category, or shared something similar.
            </p>
            {r.reason && (
              <p className="rail-text">
                <b>You:</b> {r.reason.toLowerCase()}.
              </p>
            )}
          </RailBlock>
          <RailBlock title="How helping works">
            <p className="rail-text">
              Offer what you can. The person who asked accepts offers and says
              which one helped. Helpers are credited on the request and on their
              profile.
            </p>
          </RailBlock>
          {!r.sample && !mine && <ReportButton type="help_request" id={r.id} />}
        </aside>
      </div>
    </div>
  );
}
