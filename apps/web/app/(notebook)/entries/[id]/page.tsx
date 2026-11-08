import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  FlaskConical,
  GitBranch,
  Repeat2,
  Scale,
  ShieldCheck,
  Target,
} from "lucide-react";
import { Discussion } from "@/components/discussion";
import {
  AttemptOutcome,
  EvidenceTag,
  ProposalStatus,
  RailBlock,
  Tabs,
} from "@/components/knowledge";
import { MediaGallery } from "@/components/media/media-gallery";
import { MomentPlayer } from "@/components/moment-player";
import { Picture } from "@/components/picture";
import {
  CiteAction,
  RecordActions,
  SaveAction,
} from "@/components/record-actions";
import { ReportButton } from "@/components/report-button";
import { TrustPanel } from "@/components/trust-panel";
import { MathText } from "@/components/work-blocks";
import { getEntry, getNotebook } from "@/lib/api";
import { profileById } from "@/lib/profile.server";
import { currentAccount, publicAccount } from "@/lib/auth.server";
import { listCommunities } from "@/lib/communities.server";
import { type Community } from "@/lib/communities";
import { hasDatabase } from "@/lib/db.server";
import {
  discussionSummary,
  listComments,
  ownerInsights,
} from "@/lib/discussion.server";
import { attemptHistory, listImprovements } from "@/lib/improvements.server";
import { getMediaOrigin } from "@/lib/media/reading-policy.server";
import { evidenceOf, outcomeOf } from "@/lib/outcome";
import { getProblem } from "@/lib/problems.server";
import { sampleSessions } from "@/lib/sessions";
import { lessonLabel, type Entry } from "@/lib/types";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const entry = await getEntry((await params).id);
  return {
    title: entry?.title ?? "Attempt not found",
    description: entry?.excerpt,
  };
}

const tabs = [
  ["overview", "Overview"],
  ["evidence", "Evidence"],
  ["lessons", "Lessons"],
  ["discussion", "Discussion"],
  ["related", "Related"],
  ["history", "Activity"],
] as const;
type Tab = (typeof tabs)[number][0];

/** The consistent case-study structure, matched from whatever headings were used. */
const narrative: [RegExp, string][] = [
  [
    /trying|problem|question|starting point|caught|stuck/i,
    "What were we trying to achieve?",
  ],
  [/tried|attempt|method|approach|measuring/i, "What did we try?"],
  [/happened|outcome|result/i, "What happened?"],
  [/expect/i, "What did we expect?"],
  [/why|explan|went wrong|failed|cause/i, "What may explain the difference?"],
  [
    /differently|change|next|learn|lesson|tell|would help|unknown|limitation|afterwards|avoid/i,
    "What would we do differently?",
  ],
];
const headingFor = (title: string) =>
  narrative.find(([re]) => re.test(title))?.[1] ?? title;
const kindName: Record<Entry["kind"], string> = {
  experience: "Experience",
  problem: "Open question",
  solution: "Solution",
  idea: "Idea",
  discovery: "Discovery",
  research: "Experiment",
};

/**
 * An attempt, organised like a careful case study: what was tried, what
 * happened, the evidence, the lessons, and what others built on it.
 */
export default async function AttemptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const entry = await getEntry((await params).id);
  if (!entry) notFound();
  const query = await searchParams;
  const tab = (
    query.discuss === "1"
      ? "discussion"
      : (tabs.find(([k]) => k === query.tab)?.[0] ?? "overview")
  ) as Tab;
  const t = Number(query.t);
  const start = Number.isFinite(t) && t >= 0 ? t : undefined;
  const viewer = await currentAccount();
  const isOwner = !!viewer && !!entry.owner && viewer.id === entry.owner;
  const [problem, improvements, all, summary] = await Promise.all([
    entry.problem ? getProblem(entry.problem) : undefined,
    listImprovements({ entryId: entry.id }, viewer?.id),
    listCommunities(),
    discussionSummary(entry),
  ]);
  const [firstPage, insights, history, notebook] = await Promise.all([
    tab === "discussion"
      ? listComments(entry.id, { viewer: viewer?.id })
      : undefined,
    tab === "discussion" && isOwner && viewer
      ? ownerInsights(viewer, entry.id)
      : undefined,
    tab === "history"
      ? attemptHistory(entry.id, entry.date, entry.alias)
      : undefined,
    tab === "related" ? getNotebook() : undefined,
  ]);
  const postedTo = (entry.communities ?? [])
    .map((slug) => all.find((c) => c.slug === slug))
    .filter((c): c is Community => !!c);
  const category = postedTo[0];
  const from = postedTo.find((c) => c.slug === query.from);
  const authorProfile = entry.owner
    ? await profileById(entry.owner)
    : undefined;
  const authorHref = authorProfile
    ? `/people/p_${authorProfile.publicId}`
    : `/people/${encodeURIComponent(entry.alias)}`;
  const validated = improvements.filter(
    (i) => i.verdict === "supported",
  ).length;
  const outcome = outcomeOf(entry, validated);
  const evidence = evidenceOf(entry);
  const license = entry.license ?? "CC BY 4.0";
  const contributors = [
    entry.alias,
    ...(entry.collaborators ?? []),
    ...improvements.flatMap((i) => [i.author, ...i.collaborators]),
  ].filter((n, i, a) => n && n !== "Historical record" && a.indexOf(n) === i);
  const keyLesson =
    entry.lessons?.find((l) => l.kind === "recommendation") ??
    entry.lessons?.[0];
  const href = (k: string) => {
    const params = new URLSearchParams({
      ...(k === "overview" ? {} : { tab: k }),
      ...(from ? { from: from.slug } : {}),
    });
    return `/entries/${entry.id}${params.size ? `?${params}` : ""}`;
  };
  const sessions = entry.example
    ? sampleSessions.filter((s) => s.entryId === entry.id)
    : [];
  const buildOn = [
    {
      href: `/improvements/new?entry=${entry.id}`,
      icon: <GitBranch size={16} />,
      title: "Propose an improvement",
      text: "Suggest a change, with your reasoning and a way to test it",
    },
    {
      href: `/new?type=attempt${entry.problem ? `&problem=${entry.problem}` : ""}&repeat=${entry.id}`,
      icon: <Repeat2 size={16} />,
      title: "Document a repeat attempt",
      text: "You tried the same thing. Share what happened for you",
    },
    {
      href: improvements[0]
        ? `/tests/new?improvement=${improvements[0].id}`
        : `/improvements/new?entry=${entry.id}`,
      icon: <FlaskConical size={16} />,
      title: "Create a test",
      text: improvements[0]
        ? "Plan a test of the latest proposal"
        : "Tests evaluate a proposal. Start one first",
    },
  ];

  return (
    <div className="frame knowledge-page attempt-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        {from ? (
          <Link href={`/communities/${from.slug}`} className="back-link">
            <ArrowLeft size={14} /> {from.name}
          </Link>
        ) : problem ? (
          <Link href={`/problems/${problem.id}`} className="back-link">
            <ArrowLeft size={14} /> {problem.title}
          </Link>
        ) : (
          <Link href="/discover" className="back-link">
            <ArrowLeft size={14} /> Discover
          </Link>
        )}
      </nav>
      {entry.example && (
        <p className="example-notice">
          <span className="example-tag">
            {entry.historical ? "Historical case" : "Sample data"}
          </span>{" "}
          {entry.historical
            ? "A documented failure, retold as an attempt to show how Unstuck presents a case."
            : "A fictional attempt and evidence, used to show how Unstuck works."}
        </p>
      )}
      {entry.hidden && (
        <p className="review-notice" role="status">
          This attempt is hidden from everyone else.{" "}
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
              Shared experiences are not professional advice. Consider the risks
              and consult a qualified professional.
            </p>
          </div>
        </div>
      )}

      <header className="record-head">
        <p className="record-kicker">
          {[
            category?.name ?? entry.topic,
            kindName[entry.kind],
            Number.isFinite(Date.parse(entry.date))
              ? new Date(entry.date).toLocaleDateString("en", {
                  month: "long",
                  year: "numeric",
                })
              : undefined,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <h1>{entry.title}</h1>
        <p className="record-byline">
          <span className="avatar" aria-hidden="true">
            {entry.alias.slice(0, 1).toUpperCase()}
          </span>
          <Link href={authorHref}>{entry.alias}</Link>
          {entry.affiliation && <span>{entry.affiliation}</span>}
          <span>{entry.place}</span>
        </p>
        <div className="record-outcome">
          <AttemptOutcome entry={entry} validated={validated} />
          <p>{entry.excerpt}</p>
        </div>
        <div className="record-actions-row">
          <RecordActions
            save={entry.id}
            cite={{
              title: entry.title,
              author: entry.alias,
              date: entry.date,
              path: `/entries/${entry.id}`,
              license,
              kind: "Attempt",
            }}
          />
        </div>
      </header>

      <Tabs
        label="Attempt"
        current={tab}
        href={href}
        tabs={tabs.map(
          ([k, l]) =>
            [
              k,
              l,
              k === "lessons"
                ? entry.lessons?.length
                : k === "discussion"
                  ? summary.total
                  : undefined,
            ] as const,
        )}
      />

      <div className="knowledge-grid knowledge-grid-two">
        <div className="knowledge-main">
          {tab === "overview" && (
            <>
              {keyLesson && (
                <aside className="key-lesson">
                  <span className="label">The lesson in one line</span>
                  <p>{keyLesson.text}</p>
                </aside>
              )}
              {entry.clip ? (
                <MomentPlayer clip={entry.clip} start={start} />
              ) : (
                entry.cover && (
                  <Picture
                    id="photo"
                    picture={entry.cover}
                    className="story-photo"
                    sizes="(max-width: 880px) 100vw, 720px"
                  />
                )
              )}
              {entry.mediaState && entry.mediaState !== "ready" && (
                <p className="review-notice" role="status">
                  {entry.mediaState === "pending"
                    ? "Your photos or video are waiting for a moderator. Everyone else will see them once approved."
                    : "Some photos or video are waiting for review."}
                </p>
              )}
              <MediaGallery
                attachments={entry.media ?? []}
                origin={getMediaOrigin()}
              />
              {Object.keys(entry.context).length > 0 && (
                <details className="disclosure context-panel">
                  <summary>Conditions and context</summary>
                  <dl className="facts">
                    {Object.entries(entry.context).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
              <div className="case story-body">
                {entry.sections.map((section, i) => (
                  <section key={i} id={`section-${i}`}>
                    <h2>{headingFor(section.title)}</h2>
                    <p>
                      <MathText text={section.body} />
                    </p>
                  </section>
                ))}
              </div>
              <section className="build-on" aria-labelledby="build-title">
                <h2 id="build-title">Build on this attempt</h2>
                <div className="build-grid">
                  {buildOn.map((b) => (
                    <Link key={b.title} href={b.href} className="build-card">
                      <span className="build-icon" aria-hidden="true">
                        {b.icon}
                      </span>
                      <strong>{b.title}</strong>
                      <small>{b.text}</small>
                    </Link>
                  ))}
                </div>
              </section>
            </>
          )}

          {tab === "evidence" && (
            <>
              <section className="prose-block">
                <h2>Evidence</h2>
                <p className="quiet-line">
                  {entry.personalAccount
                    ? "The contributor shared this as a personal account, labelled as such. No documents are required to contribute."
                    : "What supports this attempt, and where it came from."}
                </p>
                {entry.evidence.length > 0 && (
                  <ul className="claims">
                    {entry.evidence.map((e, i) => (
                      <li
                        key={i}
                        data-kind={
                          e.state === "verified"
                            ? "supported"
                            : e.state === "supported"
                              ? "observation"
                              : "hypothesis"
                        }
                      >
                        <span className="claim-kind">
                          {e.state === "verified"
                            ? "Verified"
                            : e.state === "supported"
                              ? "Supported by others"
                              : "Proposed explanation"}
                        </span>
                        <p>{e.label}</p>
                        <p className="claim-refs">{e.detail}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {(entry.cover || entry.photos?.length || entry.clip) && (
                <section className="prose-block">
                  <h3 className="sub-head">Photos and video</h3>
                  {entry.example && (
                    <p className="quiet-line">
                      Sample photos illustrate the story. They aren’t evidence.
                    </p>
                  )}
                  {entry.clip && (
                    <MomentPlayer clip={entry.clip} start={start} />
                  )}
                  <div className="evidence-gallery">
                    {[entry.cover, ...(entry.photos ?? [])]
                      .filter(Boolean)
                      .map((pic) => (
                        <div key={pic!.src}>
                          <Picture
                            picture={pic!}
                            sizes="(max-width: 880px) 50vw, 340px"
                          />
                        </div>
                      ))}
                  </div>
                </section>
              )}
              <MediaGallery
                attachments={entry.media ?? []}
                origin={getMediaOrigin()}
              />
              {entry.links && entry.links.length > 0 && (
                <section className="prose-block">
                  <h3 className="sub-head">Links and sources</h3>
                  <ul className="row-list">
                    {entry.links.map((l) => (
                      <li key={l.url}>
                        <a
                          href={l.url}
                          rel="noopener noreferrer nofollow"
                          target="_blank"
                        >
                          {l.label || l.url}{" "}
                          <ExternalLink size={12} aria-hidden="true" />
                        </a>
                        <span className="record-meta">
                          {l.url.startsWith("/")
                            ? "Related entry"
                            : new URL(l.url).hostname}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section className="prose-block">
                <h3 className="sub-head">Conditions</h3>
                {Object.keys(entry.context).length ? (
                  <div className="table-wrap">
                    <table className="data-table">
                      <tbody>
                        {Object.entries(entry.context).map(([k, v]) => (
                          <tr key={k}>
                            <th scope="row">{k.replaceAll("_", " ")}</th>
                            <td>{v}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="quiet-line">No conditions were recorded.</p>
                )}
                <p className="aside-note">
                  Different conditions can tell a different story. Check these
                  before reusing the result.
                </p>
              </section>
              <p className="quiet-line">
                Have supporting or contradicting evidence?{" "}
                <Link className="text-link" href={href("discussion")}>
                  Add it in the discussion
                </Link>
              </p>
            </>
          )}

          {tab === "lessons" && (
            <section className="prose-block">
              <h2>Lessons</h2>
              <p className="quiet-line">
                Each lesson says whether it is something observed, a possible
                explanation, or a recommendation.
              </p>
              {entry.lessons?.length ? (
                <ul className="lessons">
                  {entry.lessons.map((l, i) => (
                    <li key={i} data-kind={l.kind}>
                      <span className="claim-kind">{lessonLabel[l.kind]}</span>
                      <p>{l.text}</p>
                      <div className="lesson-actions">
                        <SaveAction id={`lesson:${entry.id}:${i}`} />
                        <CiteAction
                          label="Cite lesson"
                          cite={{
                            title: l.text,
                            author: entry.alias,
                            date: entry.date,
                            path: `/entries/${entry.id}?tab=lessons#lesson-${i}`,
                            license,
                            kind: "Lesson",
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="quiet-line">
                  No lessons were written down separately. The overview has the
                  full story.
                </p>
              )}
              {entry.questions && entry.questions.length > 0 && (
                <>
                  <h3 className="sub-head">Still unanswered</h3>
                  <ul className="dash-list">
                    {entry.questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {tab === "discussion" && firstPage && (
            <section className="prose-block">
              <h2>Discussion</h2>
              <p className="quiet-line">
                Ask a question, add supporting or contradicting evidence, or say
                whether it worked for you.
                {entry.openToHelp &&
                  " The contributor is open to suggestions and collaboration."}
              </p>
              <Discussion
                entryId={entry.id}
                summary={summary}
                first={firstPage}
                viewer={publicAccount(viewer)}
                isOwner={isOwner}
                insights={insights}
                enabled={hasDatabase()}
              />
            </section>
          )}

          {tab === "related" && notebook && (
            <section className="prose-block">
              <h2>Related</h2>
              {problem && (
                <Link
                  className="related-problem"
                  href={`/problems/${problem.id}`}
                >
                  <Target size={16} aria-hidden="true" />
                  <span>
                    <small>The underlying problem</small>
                    <strong>{problem.title}</strong>
                  </span>
                </Link>
              )}
              {improvements.length > 0 && (
                <>
                  <h3 className="sub-head">Improvement proposals</h3>
                  <ul className="row-list">
                    {improvements.map((i) => (
                      <li key={i.id}>
                        <Link href={`/improvements/${i.id}`}>{i.title}</Link>
                        <ProposalStatus improvement={i} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {(() => {
                const same = notebook.entries.filter(
                  (e) =>
                    e.id !== entry.id &&
                    e.kind !== "problem" &&
                    e.problem &&
                    e.problem === entry.problem,
                );
                const similar = notebook.entries
                  .filter(
                    (e) =>
                      e.id !== entry.id &&
                      e.kind !== "problem" &&
                      !same.includes(e) &&
                      e.communities?.some((c) =>
                        entry.communities?.includes(c),
                      ),
                  )
                  .slice(0, 4);
                return (
                  <>
                    {same.length > 0 && (
                      <>
                        <h3 className="sub-head">
                          Other attempts at the same problem
                        </h3>
                        <ul className="row-list">
                          {same.map((e) => (
                            <li key={e.id}>
                              <Link href={`/entries/${e.id}`}>{e.title}</Link>
                              <AttemptOutcome entry={e} />
                            </li>
                          ))}
                        </ul>
                        <Link
                          className="button button-outline"
                          href={`/analyze?ids=${[entry.id, ...same.map((e) => e.id)].slice(0, 4).join(",")}`}
                        >
                          <Scale size={15} /> Compare with similar attempts
                        </Link>
                      </>
                    )}
                    {similar.length > 0 && (
                      <>
                        <h3 className="sub-head">
                          Similar attempts in{" "}
                          {category?.name ?? "this category"}
                        </h3>
                        <ul className="row-list">
                          {similar.map((e) => (
                            <li key={e.id}>
                              <Link href={`/entries/${e.id}`}>{e.title}</Link>
                              <AttemptOutcome entry={e} />
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </>
                );
              })()}
              {sessions.map((s) => (
                <Link
                  key={s.id}
                  className="related-problem"
                  href={`/sessions/${s.id}`}
                >
                  <FlaskConical size={16} aria-hidden="true" />
                  <span>
                    <small>
                      Open inquiry · {s.rounds.flatMap((r) => r.notes).length}{" "}
                      notes
                    </small>
                    <strong>{s.title}</strong>
                  </span>
                </Link>
              ))}
            </section>
          )}

          {tab === "history" && history && (
            <section className="prose-block">
              <h2>Activity</h2>
              <p className="quiet-line">
                Publication, discussion and proposal activity. This is a
                collaboration timeline, not an archive of edited versions.
              </p>
              <ol className="history">
                {history.map((h, i) => (
                  <li key={i}>
                    <time dateTime={h.at}>{h.at.slice(0, 10)}</time>
                    <span>
                      <b>{h.who}</b>{" "}
                      {h.href ? <Link href={h.href}>{h.what}</Link> : h.what}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <aside className="knowledge-rail">
          <TrustPanel label={evidence.label}>
            <section>
              <h3>Evidence</h3>
              <dl className="facts">
                <div>
                  <dt>Evidence available</dt>
                  <dd>
                    {entry.evidence.length
                      ? entry.evidence.map((e) => e.label).join("; ")
                      : entry.personalAccount || !entry.cover
                        ? "A personal account"
                        : "Photos or video from the contributor"}
                  </dd>
                </div>
                <div>
                  <dt>Source status</dt>
                  <dd>
                    {entry.links?.length
                      ? `${entry.links.length} linked sources, not yet checked by a reviewer`
                      : "No external sources linked"}
                  </dd>
                </div>
                <div>
                  <dt>Review status</dt>
                  <dd>
                    {entry.evidence.some((e) => e.state === "verified")
                      ? "Measurements were checked against logs or instrument data"
                      : "Not reviewed"}
                  </dd>
                </div>
                <div>
                  <dt>Reproduction status</dt>
                  <dd>
                    {improvements.some((i) => i.verdict === "supported")
                      ? "An improvement was tested by contributors"
                      : entry.tried > 0
                        ? `${entry.tried} people report trying something similar; not an independent repeat`
                        : "Not repeated yet"}
                  </dd>
                </div>
                <div>
                  <dt>Known limitations</dt>
                  <dd>
                    {entry.sections.find((s) => /limit|unknown/i.test(s.title))
                      ?.body ?? "None recorded"}
                  </dd>
                </div>
              </dl>
              <p className="aside-note">
                These are kept separate on purpose. Authentic sources don’t make
                a conclusion correct, so there is no single credibility score.
              </p>
            </section>
            <section>
              <h3>Attribution</h3>
              <dl className="facts">
                <div>
                  <dt>Original author</dt>
                  <dd>
                    {entry.alias}
                    {entry.affiliation ? `, ${entry.affiliation}` : ""}
                  </dd>
                </div>
                {contributors.length > 1 && (
                  <div>
                    <dt>Contributors</dt>
                    <dd>
                      {contributors.slice(1).join(", ")} (improvements and
                      tests)
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Published</dt>
                  <dd>{entry.date}</dd>
                </div>
                <div>
                  <dt>Reuse licence</dt>
                  <dd>{license}</dd>
                </div>
              </dl>
              <p className="aside-note">
                A timestamped record documents who contributed what. It doesn’t
                establish legal ownership or protect patent rights.
              </p>
              <p>
                <Link className="text-link" href={href("history")}>
                  Publication and collaboration activity
                </Link>
              </p>
              {entry.owner && <ReportButton type="entry" id={entry.id} />}
            </section>
          </TrustPanel>
          {problem && (
            <RailBlock title="Related problem">
              <Link className="rail-link" href={`/problems/${problem.id}`}>
                {problem.title}
              </Link>
            </RailBlock>
          )}
          <RailBlock title="Outcome">
            <p className="rail-text">
              <AttemptOutcome entry={entry} validated={validated} />
            </p>
            {validated > 0 && (
              <p className="rail-text">
                A tested improvement worked under its conditions.
              </p>
            )}
            <EvidenceTag entry={entry} />
          </RailBlock>
          <RailBlock title="Contributors">
            <ul className="people">
              {contributors.slice(0, 6).map((c, i) => (
                <li key={c}>
                  <span className="avatar" aria-hidden="true">
                    {c.slice(0, 1).toUpperCase()}
                  </span>
                  <Link href={`/people/${encodeURIComponent(c)}`}>{c}</Link>
                  <small>{i === 0 ? "Author" : "Collaborator"}</small>
                </li>
              ))}
            </ul>
          </RailBlock>
          <RailBlock title="Publication">
            <p className="rail-text">
              Published {entry.date}
              <br />
              Reuse: {license}
            </p>
            {postedTo.length > 0 && (
              <p className="rail-text posted-to">
                {entry.public === false ? "Shared only with " : "In "}
                {postedTo.map((c, i) => (
                  <span key={c.slug}>
                    {i > 0 && ", "}
                    <Link href={`/communities/${c.slug}`}>{c.name}</Link>
                  </span>
                ))}
              </p>
            )}
          </RailBlock>
          {improvements.length > 0 && (
            <RailBlock title="Built on this">
              <ul className="row-list compact">
                {improvements.map((i) => (
                  <li key={i.id}>
                    <Link href={`/improvements/${i.id}`}>{i.title}</Link>
                    <ProposalStatus improvement={i} />
                  </li>
                ))}
              </ul>
            </RailBlock>
          )}
        </aside>
      </div>
    </div>
  );
}
