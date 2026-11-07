"use client";
import { useState, type FormEvent } from "react";
import {
  ChevronDown,
  Lightbulb,
  MessageSquareReply,
  Search,
  ThumbsUp,
} from "lucide-react";
import { postJson, useAccount, type Viewer } from "./use-account";
import { useNotebook } from "./notebook-provider";
import { ReportButton } from "./report-button";

type Kind =
  "comment" | "question" | "supports" | "disputes" | "worked" | "didnt";
type State = "proposed" | "supported" | "verified" | "disputed";
export interface DiscussionComment {
  id: string;
  kind: Kind;
  body: string;
  author: string;
  role: string;
  by: string;
  explanationId: string | null;
  explanationTitle?: string;
  helpful: number;
  helpedByMe: boolean;
  replies: number;
  created: string;
}
export interface DiscussionExplanation {
  id: string;
  title: string;
  detail: string;
  state: State;
  supports: number;
  disputes: number;
  people: number;
  sample: boolean;
}
export interface DiscussionSummary {
  total: number;
  people: number;
  questions: number;
  unanswered: number;
  worked: number;
  didnt: number;
  explanations: DiscussionExplanation[];
}
type Page = { items: DiscussionComment[]; next: string | null; count: number };
type Insights = {
  firstVisit: boolean;
  responses: number;
  questions: number;
  tried: number;
  evidence: number;
};

const kindLabel: Record<Kind, string> = {
  comment: "Comment",
  question: "Question",
  supports: "Supports",
  disputes: "Disputes",
  worked: "Tried it: worked",
  didnt: "Tried it: didn’t work",
};
const stateLabel: Record<State, string> = {
  proposed: "Proposed",
  supported: "Supported",
  verified: "Verified",
  disputed: "Disputed",
};
const number = (n: number) => n.toLocaleString("en");
function ago(iso: string) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  if (seconds < 86400 * 30) return `${Math.floor(seconds / 86400)} d ago`;
  return new Date(iso).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * The discussion under a field note, built for thousands of responses:
 * explanations ranked by the evidence behind them, then responses that load a
 * page at a time and can be filtered, sorted and searched.
 */
export function Discussion({
  entryId,
  summary,
  first,
  viewer: initialViewer,
  isOwner,
  insights,
  enabled,
}: {
  entryId: string;
  summary: DiscussionSummary;
  first: Page;
  viewer: Viewer;
  isOwner: boolean;
  insights?: Insights;
  enabled: boolean;
}) {
  const { viewer, signIn } = useAccount(initialViewer);
  const { notice } = useNotebook();
  const [view, setView] = useState<"all" | "questions" | "tried">("all");
  const [sort, setSort] = useState<"helpful" | "newest" | "oldest">("helpful");
  const [q, setQ] = useState("");
  const [page, setPage] = useState<Page>(first);
  const [loading, setLoading] = useState(false);
  const [showAllExplanations, setShowAllExplanations] = useState(false);
  const [composer, setComposer] = useState<{
    kind: Kind;
    explanationId?: string;
    parentId?: string;
  } | null>(null);
  const [proposing, setProposing] = useState(false);
  async function load(next: {
    view?: typeof view;
    sort?: typeof sort;
    q?: string;
    more?: boolean;
  }) {
    const v = next.view ?? view,
      s = next.sort ?? sort,
      query = next.q ?? q;
    setLoading(true);
    try {
      const params = new URLSearchParams({ view: v, sort: s });
      if (query.trim()) params.set("q", query.trim());
      if (next.more && page.next) params.set("cursor", page.next);
      const data: Page = await fetch(
        `/api/entries/${entryId}/discussion?${params}`,
      ).then((r) => r.json());
      setPage(
        next.more ? { ...data, items: [...page.items, ...data.items] } : data,
      );
    } finally {
      setLoading(false);
    }
  }
  const triedTotal = summary.worked + summary.didnt;
  const explanations = showAllExplanations
    ? summary.explanations
    : summary.explanations.slice(0, 5);
  return (
    <section className="disc" id="why" aria-labelledby="why-title">
      <header className="disc-head">
        <h2 id="why-title">Why it happened</h2>
        <p className="disc-stats">
          {summary.total ? (
            <>
              <b>{number(summary.total)}</b>{" "}
              {summary.total === 1 ? "response" : "responses"} from{" "}
              <b>{number(summary.people)}</b>{" "}
              {summary.people === 1 ? "person" : "people"}
            </>
          ) : (
            "No responses yet."
          )}
        </p>
      </header>
      {isOwner && insights && (
        <div className="disc-insights" role="status">
          <p className="disc-insights-title">
            {insights.firstVisit
              ? "On your post so far"
              : "Since your last visit"}
          </p>
          <dl>
            <div>
              <dt>New responses</dt>
              <dd>{number(insights.responses)}</dd>
            </div>
            <div>
              <dt>Questions for you</dt>
              <dd>{number(insights.questions)}</dd>
            </div>
            <div>
              <dt>People who tried it</dt>
              <dd>{number(insights.tried)}</dd>
            </div>
            <div>
              <dt>New evidence</dt>
              <dd>{number(insights.evidence)}</dd>
            </div>
          </dl>
          {summary.unanswered > 0 && (
            <button
              className="text-link"
              onClick={() => (
                setView("questions"),
                load({ view: "questions" })
              )}
            >
              {number(summary.unanswered)}{" "}
              {summary.unanswered === 1 ? "question is" : "questions are"}{" "}
              waiting for an answer
            </button>
          )}
        </div>
      )}
      {triedTotal > 0 && (
        <div className="disc-tried">
          <p>
            <b>{number(triedTotal)}</b> people tried it themselves
          </p>
          <div className="disc-tried-bar" aria-hidden="true">
            <span data-outcome="worked" style={{ flexGrow: summary.worked }} />
            <span data-outcome="failed" style={{ flexGrow: summary.didnt }} />
          </div>
          <p className="disc-tried-key">
            <span data-outcome="worked">
              Worked for {number(summary.worked)}
            </span>
            <span data-outcome="failed">
              Didn’t work for {number(summary.didnt)}
            </span>
          </p>
        </div>
      )}

      <div className="disc-block">
        <div className="disc-block-head">
          <h3>Explanations</h3>
          <span>Ranked by the evidence behind them, not by votes.</span>
        </div>
        {explanations.length ? (
          <ol className="disc-explanations">
            {explanations.map((e) => (
              <ExplanationRow
                key={e.id}
                entryId={entryId}
                explanation={e}
                onEvidence={(kind) =>
                  setComposer({ kind, explanationId: e.id })
                }
              />
            ))}
          </ol>
        ) : (
          <p className="quiet-notice">No explanations yet.</p>
        )}
        <div className="disc-row-actions">
          {summary.explanations.length > 5 && (
            <button
              className="text-link"
              onClick={() => setShowAllExplanations(!showAllExplanations)}
            >
              {showAllExplanations
                ? "Show the top 5"
                : `Show all ${summary.explanations.length} explanations`}
            </button>
          )}
          {enabled && (
            <button
              className="text-link"
              onClick={() => setProposing(!proposing)}
            >
              <Lightbulb size={14} /> Propose an explanation
            </button>
          )}
        </div>
        {proposing && (
          <ProposeForm
            entryId={entryId}
            viewer={viewer}
            signIn={signIn}
            onDone={() => {
              setProposing(false);
              notice("Explanation added. Refresh to see it ranked.");
            }}
          />
        )}
      </div>

      <div className="disc-block">
        <div className="disc-toolbar">
          <div className="disc-tabs" role="group" aria-label="Show">
            {(
              [
                ["all", "All responses", summary.total],
                ["questions", "Questions", summary.questions],
                ["tried", "Tried it", triedTotal],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                aria-pressed={view === value}
                onClick={() => {
                  setView(value);
                  load({ view: value });
                }}
              >
                {label} <span>{number(count)}</span>
              </button>
            ))}
          </div>
          <form
            className="disc-search"
            role="search"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              load({});
            }}
          >
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search responses"
              placeholder="Search responses"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </form>
          <label className="disc-sort">
            <span className="sr-only">Sort responses</span>
            <select
              value={sort}
              onChange={(e) => {
                const next = e.target.value as typeof sort;
                setSort(next);
                load({ sort: next });
              }}
            >
              <option value="helpful">Most helpful</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
            <ChevronDown size={13} aria-hidden="true" />
          </label>
        </div>
        {enabled &&
          (composer && !composer.explanationId && !composer.parentId ? (
            <Composer
              entryId={entryId}
              initial={composer}
              viewer={viewer}
              signIn={signIn}
              onCancel={() => setComposer(null)}
              onDone={() => {
                setComposer(null);
                setSort("newest");
                load({ sort: "newest" });
              }}
            />
          ) : (
            <button
              className="disc-start"
              onClick={() => setComposer({ kind: "comment" })}
            >
              Add a response, ask a question, or say whether it worked for you
            </button>
          ))}
        {composer?.explanationId && (
          <Composer
            entryId={entryId}
            initial={composer}
            viewer={viewer}
            signIn={signIn}
            explanationTitle={
              summary.explanations.find((e) => e.id === composer.explanationId)
                ?.title
            }
            onCancel={() => setComposer(null)}
            onDone={() => {
              setComposer(null);
              notice("Evidence added. Refresh to update the ranking.");
            }}
          />
        )}
        <p className="disc-count" role="status" aria-live="polite">
          {loading
            ? "Loading…"
            : page.count
              ? `Showing ${number(page.items.length)} of ${number(page.count)}`
              : q
                ? "Nothing matches that search."
                : view === "questions"
                  ? "No questions yet."
                  : view === "tried"
                    ? "Nobody has reported trying it yet."
                    : "Nobody has responded yet. Yours can be the first."}
        </p>
        <ul className="disc-list">
          {page.items.map((c) => (
            <CommentRow
              key={c.id}
              entryId={entryId}
              comment={c}
              viewer={viewer}
              signIn={signIn}
              enabled={enabled}
            />
          ))}
        </ul>
        {page.next && (
          <button
            className="button button-outline disc-more"
            disabled={loading}
            onClick={() => load({ more: true })}
          >
            Show more · {number(page.count - page.items.length)} left
          </button>
        )}
      </div>
    </section>
  );
}

function ExplanationRow({
  entryId,
  explanation: e,
  onEvidence,
}: {
  entryId: string;
  explanation: DiscussionExplanation;
  onEvidence: (kind: "supports" | "disputes") => void;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<Page | null>(null);
  async function toggle() {
    setOpen(!open);
    if (!page)
      setPage(
        await fetch(
          `/api/entries/${entryId}/discussion?view=explanation:${e.id}&sort=helpful`,
        ).then((r) => r.json()),
      );
  }
  async function more() {
    if (!page?.next) return;
    const data: Page = await fetch(
      `/api/entries/${entryId}/discussion?view=explanation:${e.id}&sort=helpful&cursor=${page.next}`,
    ).then((r) => r.json());
    setPage({ ...data, items: [...page.items, ...data.items] });
  }
  const total = e.supports + e.disputes;
  return (
    <li className="evidence-row disc-expl" data-state={e.state}>
      <span className="evidence-state">
        <span className="evidence-dot" aria-hidden="true" />
        {stateLabel[e.state]}
      </span>
      <div className="disc-expl-main">
        <h4>{e.title}</h4>
        {e.detail && <p>{e.detail}</p>}
        <div
          className="disc-meter"
          aria-label={`${e.supports} people support it, ${e.disputes} dispute it`}
        >
          <span className="disc-meter-bar" aria-hidden="true">
            <i className="is-support" style={{ flexGrow: e.supports }} />
            <i className="is-dispute" style={{ flexGrow: e.disputes }} />
          </span>
          <span>
            {number(e.supports)} support · {number(e.disputes)} dispute
          </span>
        </div>
        <div className="disc-expl-actions">
          <button className="text-link" onClick={() => onEvidence("supports")}>
            Add supporting evidence
          </button>
          <button className="text-link" onClick={() => onEvidence("disputes")}>
            Dispute it
          </button>
          {total > 0 && (
            <button className="text-link" aria-expanded={open} onClick={toggle}>
              {open
                ? "Hide evidence"
                : `See the evidence (${number(e.people)} ${e.people === 1 ? "person" : "people"})`}
            </button>
          )}
        </div>
        {open && page && (
          <ul className="disc-list disc-evidence">
            {page.items.map((c) => (
              <li key={c.id} className="disc-item" data-kind={c.kind}>
                <p className="disc-meta">
                  <b>{c.author}</b> {c.role && <span>{c.role}</span>}{" "}
                  <span className="disc-kind">{kindLabel[c.kind]}</span>
                </p>
                <Body text={c.body} />
              </li>
            ))}
            {page.next && (
              <li>
                <button className="text-link" onClick={more}>
                  Show more evidence
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </li>
  );
}

function Body({ text }: { text: string }) {
  const long = text.length > 420;
  const [open, setOpen] = useState(false);
  return (
    <>
      <p className={`disc-body ${long && !open ? "is-clamped" : ""}`}>{text}</p>
      {long && (
        <button
          className="text-link disc-readmore"
          onClick={() => setOpen(!open)}
        >
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </>
  );
}

function CommentRow({
  entryId,
  comment,
  viewer,
  signIn,
  enabled,
}: {
  entryId: string;
  comment: DiscussionComment;
  viewer: Viewer;
  signIn: (name: string, role: string) => Promise<Viewer>;
  enabled: boolean;
}) {
  const { notice } = useNotebook();
  const [helpful, setHelpful] = useState({
    count: comment.helpful,
    mine: comment.helpedByMe,
  });
  const [replies, setReplies] = useState<DiscussionComment[] | null>(null);
  const [replying, setReplying] = useState(false);
  const [replyCount, setReplyCount] = useState(comment.replies);
  async function markHelpful() {
    if (!viewer) {
      notice("Choose a name on your account page to mark responses helpful.");
      return;
    }
    try {
      const result = await postJson<{ helped: boolean; helpful: number }>(
        `/api/comments/${comment.id}/helpful`,
      );
      setHelpful({ count: result.helpful, mine: result.helped });
    } catch (error) {
      notice(error instanceof Error ? error.message : "That didn’t work.");
    }
  }
  async function showReplies() {
    if (replies) return setReplies(null);
    setReplies(
      (await fetch(`/api/comments/${comment.id}/replies`).then((r) => r.json()))
        .items,
    );
  }
  return (
    <li
      className="disc-item"
      id={`comment-${comment.id}`}
      data-kind={comment.kind}
    >
      <p className="disc-meta">
        <b>{comment.author}</b>
        {comment.role && <span>{comment.role}</span>}
        <span>{ago(comment.created)}</span>
        {comment.kind !== "comment" && (
          <span className="disc-kind">{kindLabel[comment.kind]}</span>
        )}
        {comment.explanationTitle && (
          <span className="disc-about">on “{comment.explanationTitle}”</span>
        )}
      </p>
      <Body text={comment.body} />
      <div className="disc-actions">
        <button
          className={`disc-helpful ${helpful.mine ? "is-on" : ""}`}
          aria-pressed={helpful.mine}
          onClick={markHelpful}
        >
          <ThumbsUp size={13} /> Helpful
          {helpful.count ? ` · ${number(helpful.count)}` : ""}
        </button>
        {enabled && (
          <button
            className="disc-action"
            onClick={() => setReplying(!replying)}
          >
            <MessageSquareReply size={13} /> Reply
          </button>
        )}
        {replyCount > 0 && (
          <button
            className="disc-action"
            aria-expanded={!!replies}
            onClick={showReplies}
          >
            {replies
              ? "Hide replies"
              : `${number(replyCount)} ${replyCount === 1 ? "reply" : "replies"}`}
          </button>
        )}
        {viewer?.id !== comment.by && (
          <ReportButton type="comment" id={comment.id} />
        )}
      </div>
      {replying && (
        <Composer
          entryId={entryId}
          initial={{ kind: "comment", parentId: comment.id }}
          viewer={viewer}
          signIn={signIn}
          onCancel={() => setReplying(false)}
          onDone={async () => {
            setReplying(false);
            setReplyCount((n) => n + 1);
            setReplies(
              (
                await fetch(`/api/comments/${comment.id}/replies`).then((r) =>
                  r.json(),
                )
              ).items,
            );
          }}
        />
      )}
      {replies && (
        <ul className="disc-replies">
          {replies.map((r) => (
            <li key={r.id} className="disc-item disc-reply">
              <p className="disc-meta">
                <b>{r.author}</b>
                {r.role && <span>{r.role}</span>}
                <span>{ago(r.created)}</span>
              </p>
              <Body text={r.body} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Composer({
  entryId,
  initial,
  viewer,
  signIn,
  explanationTitle,
  onCancel,
  onDone,
}: {
  entryId: string;
  initial: { kind: Kind; explanationId?: string; parentId?: string };
  viewer: Viewer;
  signIn: (name: string, role: string) => Promise<Viewer>;
  explanationTitle?: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [kind, setKind] = useState<Kind>(initial.kind);
  const [body, setBody] = useState("");
  const [who, setWho] = useState({ name: "", role: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const choices: Kind[] = initial.parentId
    ? ["comment"]
    : initial.explanationId
      ? ["supports", "disputes"]
      : ["comment", "question", "worked", "didnt"];
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!viewer) await signIn(who.name, who.role);
      await postJson(`/api/entries/${entryId}/comments`, {
        kind,
        body,
        explanationId: initial.explanationId,
        parentId: initial.parentId,
      });
      setBody("");
      onDone();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "That couldn’t be posted.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="disc-composer" onSubmit={submit}>
      {explanationTitle && (
        <p className="disc-meta">Evidence about “{explanationTitle}”</p>
      )}
      {choices.length > 1 && (
        <div
          className="note-types"
          role="radiogroup"
          aria-label="Kind of response"
        >
          {choices.map((choice) => (
            <label
              key={choice}
              className={kind === choice ? "is-on" : ""}
              data-note={
                choice === "disputes" || choice === "didnt"
                  ? "issue"
                  : "suggestion"
              }
            >
              <input
                type="radio"
                name={`kind-${entryId}-${initial.parentId ?? initial.explanationId ?? "new"}`}
                checked={kind === choice}
                onChange={() => setKind(choice)}
              />
              {kindLabel[choice]}
            </label>
          ))}
        </div>
      )}
      <label
        className="sr-only"
        htmlFor={`body-${initial.parentId ?? initial.explanationId ?? "new"}`}
      >
        Your response
      </label>
      <textarea
        id={`body-${initial.parentId ?? initial.explanationId ?? "new"}`}
        rows={3}
        value={body}
        maxLength={5000}
        placeholder={
          kind === "worked" || kind === "didnt"
            ? "Where you tried it, what was different, and what you saw."
            : kind === "supports" || kind === "disputes"
              ? "What you observed or measured, and how."
              : "Be specific. Say what you saw and what you’d try."
        }
        onChange={(e) => setBody(e.target.value)}
      />
      {!viewer && (
        <div className="form-row post-as">
          <label>
            <span>Post as</span>
            <input
              value={who.name}
              maxLength={40}
              placeholder="Your name"
              onChange={(e) => setWho({ ...who, name: e.target.value })}
            />
          </label>
          <label>
            <span>Your role, optional</span>
            <input
              value={who.role}
              maxLength={60}
              placeholder="Farmer"
              onChange={(e) => setWho({ ...who, role: e.target.value })}
            />
          </label>
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="note-submit">
        <button type="button" className="text-link" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="button button-dark"
          disabled={
            busy ||
            body.trim().length < 2 ||
            (!viewer && who.name.trim().length < 2)
          }
        >
          {busy ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}

function ProposeForm({
  entryId,
  viewer,
  signIn,
  onDone,
}: {
  entryId: string;
  viewer: Viewer;
  signIn: (name: string, role: string) => Promise<Viewer>;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [who, setWho] = useState({ name: "", role: "" });
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      if (!viewer) await signIn(who.name, who.role);
      await postJson(`/api/entries/${entryId}/explanations`, { title, detail });
      onDone();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "That couldn’t be posted.",
      );
    }
  }
  return (
    <form className="disc-composer" onSubmit={submit}>
      <label className="sr-only" htmlFor={`propose-${entryId}`}>
        Your explanation
      </label>
      <input
        id={`propose-${entryId}`}
        className="disc-propose-title"
        value={title}
        maxLength={200}
        placeholder="Your explanation in one sentence"
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        rows={2}
        value={detail}
        maxLength={2000}
        placeholder="What makes you think so? (optional)"
        onChange={(e) => setDetail(e.target.value)}
      />
      {!viewer && (
        <div className="form-row post-as">
          <label>
            <span>Post as</span>
            <input
              value={who.name}
              maxLength={40}
              placeholder="Your name"
              onChange={(e) => setWho({ ...who, name: e.target.value })}
            />
          </label>
          <label>
            <span>Your role, optional</span>
            <input
              value={who.role}
              maxLength={60}
              placeholder="Engineer"
              onChange={(e) => setWho({ ...who, role: e.target.value })}
            />
          </label>
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="note-submit">
        <span />
        <button
          className="button button-dark"
          disabled={
            title.trim().length < 6 || (!viewer && who.name.trim().length < 2)
          }
        >
          Add explanation
        </button>
      </div>
    </form>
  );
}
