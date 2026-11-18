import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Lock,
  MapPin,
  Target,
  Users,
} from "lucide-react";
import {
  Pill,
  ProblemStatePill,
  RailBlock,
  Tabs,
} from "@/components/knowledge";
import { OrgMark } from "@/components/org-mark";
import { RecordActions } from "@/components/record-actions";
import { patterns } from "@/lib/lessons";
import {
  organizationById,
  orgKindLabel,
  orgRoleHelp,
  orgRoleLabel,
  reportKindLabel,
  type OrgRole,
} from "@/lib/organizations";
import { problemsWithWork } from "@/lib/problems.server";
import { catalog } from "@/lib/refs.server";
import { sampleWorkspaces, visibilityLabel } from "@/lib/workspaces";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const o = organizationById((await params).id);
  return { title: o?.name ?? "Organisation", description: o?.tagline };
}
const tabs = [
  ["overview", "Overview"],
  ["projects", "Projects"],
  ["people", "People"],
  ["reports", "Reports"],
  ["settings", "Settings"],
] as const;
type Tab = (typeof tabs)[number][0];

/**
 * An organisation’s home: who they are, what they work on, the people
 * involved, what they’ve reported, and how they run things. Contributions
 * stay credited to the people who made them.
 */
export default async function Organization({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const o = organizationById((await params).id);
  if (!o) notFound();
  const query = await searchParams;
  const tab = (tabs.find(([k]) => k === query.tab)?.[0] ?? "overview") as Tab;
  const [refs, work] = await Promise.all([
    catalog(),
    problemsWithWork(o.problems),
  ]);
  // Reports can cite patterns and workspaces as well as records.
  for (const p of patterns)
    refs[p.id] ??= {
      label: p.title,
      href: `/lessons/${p.id}`,
      kind: "Pattern",
    };
  for (const w of sampleWorkspaces)
    refs[w.id] ??= {
      label: w.title,
      href: `/workspaces/${w.id}`,
      kind: "Workspace",
    };
  const spaces = sampleWorkspaces.filter((w) => o.workspaces.includes(w.id));
  const href = (k: string) =>
    `/organizations/${o.id}${k === "overview" ? "" : `?tab=${k}`}`;
  const cite = (ids: string[]) =>
    ids
      .filter((r) => refs[r])
      .map((r, n) => (
        <span key={r}>
          {n > 0 && ", "}
          <Link href={refs[r].href}>{refs[r].label}</Link>
        </span>
      ));
  return (
    <div className="frame knowledge-page org-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/organizations" className="back-link">
          <ArrowLeft size={14} /> Organisations
        </Link>
      </nav>
      {o.sample && (
        <p className="example-notice">
          <span className="example-tag">Sample data</span> A fictional
          organisation, showing the organisation template.
        </p>
      )}
      <header className="org-head">
        <OrgMark name={o.name} size="l" />
        <div>
          <p className="record-kicker">
            {orgKindLabel[o.kind]} · <MapPin size={12} aria-hidden="true" />{" "}
            {o.place}
            {o.founded && ` · since ${o.founded}`}
          </p>
          <h1>{o.name}</h1>
          <p className="record-lede">{o.tagline}</p>
          <ul className="need-list">
            {o.focus.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
        <RecordActions save={`org:${o.id}`}>
          {o.website && (
            <a
              className="chip-action"
              href={o.website}
              rel="noopener noreferrer"
              target="_blank"
            >
              Website <ExternalLink size={13} aria-hidden="true" />
            </a>
          )}
        </RecordActions>
      </header>

      <Tabs
        label="Organisation"
        current={tab}
        href={href}
        tabs={tabs.map(
          ([k, l]) =>
            [
              k,
              l,
              k === "projects"
                ? o.problems.length + o.workspaces.length
                : k === "people"
                  ? o.members.length
                  : k === "reports"
                    ? o.reports.length
                    : undefined,
            ] as const,
        )}
      />

      <div
        className={
          tab === "overview"
            ? "knowledge-grid knowledge-grid-two"
            : "knowledge-grid studio-grid"
        }
      >
        <div className="knowledge-main">
          {tab === "overview" && (
            <>
              <section className="prose-block">
                <h2>About</h2>
                <p>{o.about}</p>
              </section>
              {o.reports[0] && (
                <section className="org-latest">
                  <span className="label">
                    Latest report · {reportKindLabel[o.reports[0].kind]}
                  </span>
                  <h2>{o.reports[0].title}</h2>
                  <p>{o.reports[0].summary}</p>
                  <p className="claim-refs">
                    Based on {cite(o.reports[0].refs)}
                  </p>
                </section>
              )}
              <section className="prose-block">
                <h2>What they’re working on</h2>
                <ul className="row-list">
                  {work.map((w) => (
                    <li key={w.problem.id}>
                      <Link href={`/problems/${w.problem.id}`}>
                        {w.problem.title}
                      </Link>
                      <ProblemStatePill state={w.state} />
                    </li>
                  ))}
                  {spaces.map((w) => (
                    <li key={w.id}>
                      <Link href={`/workspaces/${w.id}`}>{w.title}</Link>
                      <span className="record-meta">
                        Workspace{w.place ? ` · ${w.place}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              {o.featured.length > 0 && (
                <section className="prose-block">
                  <h2>Shared by its people</h2>
                  <ul className="row-list">
                    {o.featured
                      .filter((f) => refs[f])
                      .map((f) => (
                        <li key={f}>
                          <Link href={refs[f].href}>{refs[f].label}</Link>
                          <span className="record-meta">{refs[f].kind}</span>
                        </li>
                      ))}
                  </ul>
                  <p className="aside-note">
                    Each contribution stays credited to the person who made it.
                    Being affiliated doesn’t give an organisation authorship or
                    rights.
                  </p>
                </section>
              )}
            </>
          )}

          {tab === "projects" && (
            <>
              <section className="prose-block">
                <h2>Problems</h2>
                <ul className="proposal-list">
                  {work.map((w) => (
                    <li key={w.problem.id} className="proposal-row">
                      <div className="attempt-top">
                        <ProblemStatePill state={w.state} />
                        <span className="record-meta">
                          {w.attempts.length} attempts · {w.improvements.length}{" "}
                          proposals · {w.tests.length} tests
                        </span>
                      </div>
                      <h3>
                        <Target size={15} aria-hidden="true" />{" "}
                        <Link href={`/problems/${w.problem.id}`}>
                          {w.problem.title}
                        </Link>
                      </h3>
                      <p>{w.problem.summary}</p>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="prose-block">
                <h2>Workspaces</h2>
                {spaces.length ? (
                  <ul className="ws-grid">
                    {spaces.map((w) => (
                      <li key={w.id}>
                        <Link className="ws-card" href={`/workspaces/${w.id}`}>
                          <span className="ws-top">
                            <Pill
                              tone={
                                w.visibility === "public" ? "ongoing" : "quiet"
                              }
                            >
                              {w.visibility !== "public" && (
                                <Lock size={11} aria-hidden="true" />
                              )}
                              {visibilityLabel[w.visibility]}
                            </Pill>
                          </span>
                          <strong>{w.title}</strong>
                          <small>{w.goal}</small>
                          {w.concerns && (
                            <span className="ws-stats">
                              <span>{w.concerns.open} open concerns</span>
                              <span>{w.concerns.resolved} resolved</span>
                            </span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="quiet-line">
                    No public workspaces. Private ones are visible only to
                    members.
                  </p>
                )}
              </section>
            </>
          )}

          {tab === "people" && (
            <section className="prose-block">
              <h2>People</h2>
              <ul className="org-people">
                {o.members.map((m) => (
                  <li key={m.name}>
                    <span className="avatar avatar-lg" aria-hidden="true">
                      {m.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="person">
                      <strong>{m.name}</strong>
                      {m.title && <small>{m.title}</small>}
                    </span>
                    <span className="kind-tag">{orgRoleLabel[m.role]}</span>
                  </li>
                ))}
              </ul>
              <dl className="facts">
                {(Object.keys(orgRoleLabel) as OrgRole[]).map((r) => (
                  <div key={r}>
                    <dt>{orgRoleLabel[r]}</dt>
                    <dd>{orgRoleHelp[r]}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {tab === "reports" && (
            <section className="prose-block">
              <h2>Reports</h2>
              <p className="quiet-line">
                Progress summaries, findings and lessons. Each one links the
                records it rests on.
              </p>
              <ul className="reports">
                {o.reports.map((r) => (
                  <li key={r.id}>
                    <FileText size={18} aria-hidden="true" />
                    <div>
                      <p className="thread-meta">
                        <span className="kind-tag">
                          {reportKindLabel[r.kind]}
                        </span>
                        <time dateTime={r.date}>{r.date}</time>
                      </p>
                      <h3>{r.title}</h3>
                      <p>{r.summary}</p>
                      <p className="claim-refs">Based on {cite(r.refs)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tab === "settings" && (
            <section className="prose-block">
              <h2>Settings</h2>
              <p className="aside-note">
                Only admins can change these. This is how an organisation
                account is set up; organisation accounts aren’t open yet.
              </p>
              <dl className="facts settings-list">
                <div>
                  <dt>New workspaces start as</dt>
                  <dd>
                    {visibilityLabel[o.defaults.visibility]}. Admins can change
                    any workspace later.
                  </dd>
                </div>
                <div>
                  <dt>Publishing</dt>
                  <dd>
                    {o.defaults.review
                      ? "An admin reviews before anything is published in the organisation’s name. People can always publish under their own name."
                      : "Members publish under their own name, and can choose to show the affiliation."}
                  </dd>
                </div>
                <div>
                  <dt>Authorship and rights</dt>
                  <dd>
                    Contributions stay with the people who made them. The
                    organisation is shown as an affiliation, not as the author.
                  </dd>
                </div>
                <div>
                  <dt>Membership</dt>
                  <dd>
                    Admins invite members and guests and set their roles. Guests
                    see only the workspaces they’re invited to.
                  </dd>
                </div>
                <div>
                  <dt>Billing</dt>
                  <dd>Where applicable, managed by admins.</dd>
                </div>
              </dl>
            </section>
          )}
        </div>

        {tab === "overview" && (
          <aside className="knowledge-rail">
            <RailBlock title="At a glance">
              <dl className="glance">
                <div>
                  <dt>People</dt>
                  <dd>{o.members.length}</dd>
                </div>
                <div>
                  <dt>Problems</dt>
                  <dd>{o.problems.length}</dd>
                </div>
                <div>
                  <dt>Reports</dt>
                  <dd>{o.reports.length}</dd>
                </div>
              </dl>
            </RailBlock>
            <RailBlock title="People">
              <ul className="people">
                {o.members.slice(0, 5).map((m) => (
                  <li key={m.name}>
                    <span className="avatar" aria-hidden="true">
                      {m.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span>{m.name}</span>
                    <small>{orgRoleLabel[m.role]}</small>
                  </li>
                ))}
              </ul>
              <Link className="text-link" href={href("people")}>
                <Users size={13} aria-hidden="true" /> Everyone
              </Link>
            </RailBlock>
          </aside>
        )}
      </div>
    </div>
  );
}
