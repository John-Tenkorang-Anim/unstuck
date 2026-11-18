import type { Metadata } from "next";
import Link from "next/link";
import { HandHeart, Lock, MapPin, Plus, Search, Users } from "lucide-react";
import { Pill } from "@/components/knowledge";
import { currentAccount } from "@/lib/auth.server";
import {
  concernHref,
  concernReference,
  concernStatus,
  concernTone,
} from "@/lib/concerns";
import { listConcerns } from "@/lib/concerns.server";
import { listProblems } from "@/lib/problems.server";
import { visibilityLabel, type Workspace } from "@/lib/workspaces";
import { workspaceDirectory } from "@/lib/workspaces.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Workspaces" };

/**
 * Workspaces are where neighbours and teams work things out together: raise
 * what’s wrong where they live, follow every response and promise, and
 * organise the ideas and tests that fix it.
 */
export default async function Workspaces({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (k: string) => (typeof params[k] === "string" ? params[k] : "");
  const q = one("q");
  const place = one("place");
  const mine = one("show") === "mine";
  const page = Math.max(1, Number(one("page")) || 1);
  const viewer = await currentAccount();
  const [directory, waiting, problems] = await Promise.all([
    workspaceDirectory(viewer, { q, place, page, mine }),
    listConcerns({ attention: true, place, size: 4, publicOnly: true }, viewer),
    listProblems(),
  ]);
  const hubs = [...directory.items, ...(page === 1 ? directory.examples : [])];
  const link = (change: Record<string, string>) => {
    const next = new URLSearchParams({
      ...(q ? { q } : {}),
      ...(place ? { place } : {}),
      ...(mine ? { show: "mine" } : {}),
      ...change,
    });
    for (const [k, v] of [...next]) if (!v) next.delete(k);
    return `/workspaces${next.size ? `?${next}` : ""}`;
  };
  return (
    <div className="frame directory hubs">
      <section className="hub-hero" aria-labelledby="hubs-title">
        <div>
          <h1 id="hubs-title">Work it out together.</h1>
          <p>
            Raise what’s wrong where you live, follow every promise, and fix it
            with your neighbours.
          </p>
        </div>
        <form className="directory-search" action="/workspaces" role="search">
          <Search size={16} aria-hidden="true" />
          <input
            name="q"
            defaultValue={q}
            placeholder="What are you working on?"
            aria-label="Search workspaces"
          />
          <span className="hub-place">
            <MapPin size={15} aria-hidden="true" />
            <input
              name="place"
              defaultValue={place}
              placeholder="Where?"
              aria-label="Place"
            />
          </span>
          <button className="button button-dark">Find</button>
        </form>
      </section>

      {waiting.items.length > 0 && (
        <section className="dv-section" aria-labelledby="waiting-title">
          <div className="dv-section-head">
            <h2 id="waiting-title">Waiting for a response</h2>
          </div>
          <ul className="waiting">
            {waiting.items.map((c) => (
              <li key={`${c.workspace}-${c.id}`}>
                <Link href={concernHref(c)}>
                  <span className="concern-ref">
                    {concernReference(c.number)}
                  </span>
                  <strong>{c.title}</strong>
                  <small>
                    <MapPin size={12} aria-hidden="true" />{" "}
                    {c.place || c.workspaceTitle}
                  </small>
                  <span className="waiting-foot">
                    <span className="pill" data-tone={concernTone[c.status]}>
                      <i aria-hidden="true" />
                      {concernStatus[c.status]}
                    </span>
                    <span className="concern-support">
                      <HandHeart size={14} aria-hidden="true" /> {c.supporters}{" "}
                      affected
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="dv-section" aria-labelledby="all-title">
        <div className="dv-section-head">
          <h2 id="all-title">
            {q || place
              ? `${directory.total + (page === 1 ? directory.examples.length : 0)} workspaces found`
              : "Workspaces"}
          </h2>
          <span className="hub-tools">
            {viewer && (
              <nav className="seg" aria-label="Show">
                <Link
                  href={link({ show: "", page: "" })}
                  aria-current={!mine ? "true" : undefined}
                >
                  Everyone’s
                </Link>
                <Link
                  href={link({ show: "mine", page: "" })}
                  aria-current={mine ? "true" : undefined}
                >
                  Mine
                </Link>
              </nav>
            )}
            <Link className="text-link" href="/organizations">
              Organisations
            </Link>
            <Link className="button button-dark" href="/workspaces/new">
              <Plus size={15} aria-hidden="true" /> Start one
            </Link>
          </span>
        </div>
        {hubs.length === 0 ? (
          <div className="empty-state">
            <h3>
              {mine
                ? "You’re not in a workspace yet."
                : "Nobody has started one here yet."}
            </h3>
            <p>
              Start one for your street, school or project. You choose who can
              see it.
            </p>
            <Link className="button button-dark" href="/workspaces/new">
              Start a workspace
            </Link>
          </div>
        ) : (
          <ul className="ws-grid">
            {hubs.map((w) => (
              <li key={w.id}>
                <HubCard
                  w={w}
                  problem={problems.find((p) => p.id === w.problemId)?.title}
                />
              </li>
            ))}
          </ul>
        )}
        {directory.pages > 1 && (
          <nav className="seg pager" aria-label="Pages">
            {Array.from({ length: directory.pages }, (_, n) => n + 1).map(
              (n) => (
                <Link
                  key={n}
                  href={link({ page: n === 1 ? "" : String(n) })}
                  aria-current={n === page ? "page" : undefined}
                >
                  {n}
                </Link>
              ),
            )}
          </nav>
        )}
      </section>
    </div>
  );
}

function HubCard({ w, problem }: { w: Workspace; problem?: string }) {
  const c = w.concerns;
  const done = c && c.total ? Math.round((c.resolved / c.total) * 100) : 0;
  return (
    <Link className="ws-card hub" href={`/workspaces/${w.id}`}>
      <span className="ws-top">
        {w.place ? (
          <span className="hub-where">
            <MapPin size={13} aria-hidden="true" /> {w.place}
          </span>
        ) : (
          <span className="hub-where">{w.topic || "Project"}</span>
        )}
        {w.visibility !== "public" && (
          <Pill tone="quiet">
            <Lock size={11} aria-hidden="true" />{" "}
            {visibilityLabel[w.visibility]}
          </Pill>
        )}
        {w.sample && <span className="example-tag">Sample</span>}
      </span>
      <strong>{w.title}</strong>
      {(problem || w.goal) && <small>{problem ?? w.goal}</small>}
      {c && c.total > 0 && (
        <span
          className="hub-meter"
          aria-label={`${c.resolved} of ${c.total} concerns resolved`}
        >
          <span className="meter" aria-hidden="true">
            <i style={{ width: `${done}%` }} />
          </span>
          <span className="meter-text">
            {c.open} open · {c.resolved} resolved
            {c.overdue > 0 && <b> · {c.overdue} overdue</b>}
          </span>
        </span>
      )}
      <span className="ws-stats">
        <span>
          <Users size={13} aria-hidden="true" />{" "}
          {w.memberCount ?? w.members.length} members
        </span>
        <span>Active {w.updated.slice(0, 10)}</span>
      </span>
    </Link>
  );
}
