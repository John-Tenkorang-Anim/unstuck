import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  FlaskConical,
  GitBranch,
  HandHelping,
  Plus,
  Search,
  Users,
} from "lucide-react";
import {
  AttemptOutcome,
  ProblemStatePill,
  ProposalStatus,
  Tabs,
} from "@/components/knowledge";
import { problemStates, type ProblemState } from "@/lib/problems";
import { problemsWithWork, type ProblemWork } from "@/lib/problems.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Problems" };

const ago = (date: string) => {
  const days = Math.round((Date.now() - Date.parse(date)) / 864e5);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return date.slice(0, 4);
};

/**
 * The problems directory: what people are trying to solve, sorted by the
 * state of the knowledge effort. A list on the left and a preview on the
 * right, so people can scan without opening dozens of pages.
 */
export default async function Problems({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (k: string) => (typeof params[k] === "string" ? params[k] : "");
  const tab = (problemStates.find(([k]) => k === one("tab"))?.[0] ??
    "open") as ProblemState;
  const q = one("q").trim().toLowerCase();
  const category = one("category");
  const all = await problemsWithWork();
  const matches = all.filter(
    (w) =>
      (!category || w.problem.category === category) &&
      (!q ||
        [
          w.problem.title,
          w.problem.summary,
          w.problem.category,
          ...(w.problem.subtopics ?? []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)),
  );
  const count = (s: ProblemState) =>
    matches.filter((w) => w.state === s).length;
  const shown = matches
    .filter((w) => w.state === tab)
    .sort((a, b) => b.updated.localeCompare(a.updated));
  const selected = shown.find((w) => w.problem.id === one("p")) ?? shown[0];
  const categories = [...new Set(all.map((w) => w.problem.category))].sort();
  const link = (change: Record<string, string>) => {
    const next = new URLSearchParams({
      ...(q ? { q: one("q") } : {}),
      ...(category ? { category } : {}),
      ...(tab !== "open" ? { tab } : {}),
      ...change,
    });
    for (const [k, v] of [...next]) if (!v) next.delete(k);
    return `/problems${next.size ? `?${next}` : ""}`;
  };
  return (
    <div className="frame directory">
      <header className="editorial-head">
        <div>
          <h1>What are people trying to solve?</h1>
          <p>
            Open challenges, the attempts made so far, and where help would make
            the most difference.
          </p>
        </div>
        <Link className="button button-dark" href="/new?type=problem">
          <Plus size={15} aria-hidden="true" /> Describe a problem
        </Link>
      </header>

      <form className="directory-search" action="/problems" role="search">
        <Search size={16} aria-hidden="true" />
        <input
          name="q"
          defaultValue={one("q")}
          placeholder="Search problems by goal, topic or place"
          aria-label="Search problems"
        />
        {tab !== "open" && <input type="hidden" name="tab" value={tab} />}
        <select name="category" defaultValue={category} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button className="button button-dark">Search</button>
      </form>

      <Tabs
        label="Problem state"
        current={tab}
        href={(k) => link({ tab: k === "open" ? "" : k, p: "" })}
        tabs={problemStates.map(([k, label]) => [k, label, count(k)] as const)}
      />
      <p className="tab-note">
        {problemStates.find(([k]) => k === tab)?.[2]}. States describe the work
        here, not whether a problem is solved everywhere.
      </p>

      {shown.length === 0 ? (
        <div className="empty-state">
          <h3>Nothing here yet.</h3>
          <p>
            {q || category
              ? "Try a broader search."
              : "Have you faced something similar? Describe it and others can help."}
          </p>
          <Link className="button button-dark" href="/new?type=problem">
            Describe a problem <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <div className="split">
          <ul className="problem-list">
            {shown.map((w) => {
              const active = w.problem.id === selected?.problem.id;
              return (
                <li key={w.problem.id} data-active={active || undefined}>
                  <Link
                    className="problem-row"
                    href={link({ p: w.problem.id })}
                    aria-current={active ? "true" : undefined}
                    scroll={false}
                  >
                    <span className="problem-row-meta">
                      {w.problem.category}
                      {w.problem.place && ` · ${w.problem.place}`}
                    </span>
                    <strong>{w.problem.title}</strong>
                    <span className="problem-row-summary">
                      {w.problem.summary}
                    </span>
                    <span className="problem-row-stats">
                      <span>
                        {w.attempts.length}{" "}
                        {w.attempts.length === 1 ? "attempt" : "attempts"}
                      </span>
                      <span>
                        {w.improvements.length}{" "}
                        {w.improvements.length === 1 ? "proposal" : "proposals"}
                      </span>
                      {w.problem.needs[0] && (
                        <span className="problem-need">
                          Seeking {w.problem.needs[0].toLowerCase()}
                        </span>
                      )}
                      <span className="problem-when">
                        Active {ago(w.updated)}
                      </span>
                    </span>
                  </Link>
                  {active && (
                    <div className="preview-inline">
                      <Preview work={w} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {selected && (
            <aside className="preview-pane" aria-label="Preview">
              <Preview work={selected} />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}

function Preview({ work: w }: { work: ProblemWork }) {
  const p = w.problem;
  const recent = [
    ...w.improvements.flatMap((i) =>
      i.events.map((e) => ({
        at: e.created,
        text: `${e.actor}: ${e.kind === "created" ? "proposed" : e.kind === "status" ? `moved to ${e.to}` : e.kind}`,
        href: `/improvements/${i.id}`,
      })),
    ),
    ...w.tests.flatMap((t) =>
      t.runs.map((r) => ({
        at: r.date,
        text: `${r.by}: recorded a test run`,
        href: `/tests/${t.id}`,
      })),
    ),
    ...w.attempts.map((a) => ({
      at: a.date,
      text: `${a.alias}: shared an attempt`,
      href: `/entries/${a.id}`,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 4);
  return (
    <div className="preview">
      <div className="preview-head">
        <ProblemStatePill state={w.state} />
        <span className="preview-meta">
          <Users size={13} aria-hidden="true" /> {w.contributors.length}{" "}
          {w.contributors.length === 1 ? "contributor" : "contributors"}
        </span>
      </div>
      <h2>
        <Link href={`/problems/${p.id}`}>{p.title}</Link>
      </h2>
      <p>{p.summary}</p>
      <div className="preview-actions">
        <Link className="button button-dark" href={`/problems/${p.id}`}>
          Explore problem <ArrowRight size={14} />
        </Link>
        <Link
          className="button button-outline"
          href={`/new?type=attempt&problem=${p.id}`}
        >
          Share an attempt
        </Link>
        <details className="pick help-menu">
          <summary>
            <HandHelping size={14} aria-hidden="true" /> I can help
          </summary>
          <div className="pick-menu">
            <Link href={`/problems/${p.id}?tab=discussion&offer=expertise`}>
              Offer expertise
            </Link>
            <Link href={`/problems/${p.id}?tab=discussion&offer=evidence`}>
              Add evidence
            </Link>
            <Link href={`/improvements/new?problem=${p.id}`}>
              Propose an improvement
            </Link>
            <Link href={`/problems/${p.id}?tab=discussion&offer=testing`}>
              Help test
            </Link>
            <Link href={`/problems/${p.id}?tab=discussion&offer=resources`}>
              Offer equipment or funding
            </Link>
          </div>
        </details>
      </div>
      {w.attempts.length > 0 && (
        <section>
          <h3 className="preview-label">Attempts</h3>
          <ul className="preview-list">
            {w.attempts.slice(0, 3).map((a) => (
              <li key={a.id}>
                <Link href={`/entries/${a.id}`}>{a.title}</Link>
                <AttemptOutcome entry={a} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {w.improvements.length > 0 && (
        <section>
          <h3 className="preview-label">Improvements</h3>
          <ul className="preview-list">
            {w.improvements.slice(0, 3).map((i) => (
              <li key={i.id}>
                <Link href={`/improvements/${i.id}`}>
                  <GitBranch size={13} aria-hidden="true" /> {i.title}
                </Link>
                <ProposalStatus improvement={i} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {p.needs.length > 0 && (
        <section>
          <h3 className="preview-label">What would help</h3>
          <ul className="need-list">
            {p.needs.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      )}
      {recent.length > 0 && (
        <section>
          <h3 className="preview-label">Recent activity</h3>
          <ul className="activity-mini">
            {recent.map((r, i) => (
              <li key={i}>
                <Link href={r.href}>{r.text}</Link>
                <time dateTime={r.at}>{ago(r.at)}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
      {w.tests.length > 0 && (
        <p className="preview-meta">
          <FlaskConical size={13} aria-hidden="true" /> {w.tests.length}{" "}
          {w.tests.length === 1 ? "test" : "tests"} recorded
        </p>
      )}
    </div>
  );
}
