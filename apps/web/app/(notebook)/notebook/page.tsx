import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  FilePen,
  FlaskConical,
  GitBranch,
  NotebookPen,
  Target,
  Users,
} from "lucide-react";
import {
  AttemptOutcome,
  Pill,
  ProposalStatus,
  Tabs,
} from "@/components/knowledge";
import { MyPosts } from "@/components/my-posts";
import { PostForm } from "@/components/record-actions";
import { SavedList } from "@/components/saved-list";
import { currentAccount } from "@/lib/auth.server";
import { listCommunities } from "@/lib/communities.server";
import { hasDatabase } from "@/lib/db.server";
import { myDrafts } from "@/lib/drafts.server";
import { repliesToMe } from "@/lib/discussion.server";
import { publishedEntries } from "@/lib/entries.server";
import { following } from "@/lib/follows.server";
import { improvementsBy } from "@/lib/improvements.server";
import { problemsBy } from "@/lib/problems.server";
import { profileById, purposes } from "@/lib/profile.server";
import { catalog, followingRef } from "@/lib/refs.server";
import { testStatusLabel } from "@/lib/tests";
import { allTests } from "@/lib/tests.server";
import { roleLabel } from "@/lib/workspaces";
import { myWorkspaces } from "@/lib/workspaces.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My Space" };
const tabs = [
  ["overview", "Overview"],
  ["contributions", "Contributions"],
  ["drafts", "Drafts"],
  ["saved", "Saved"],
  ["collaborations", "Collaborations"],
] as const;
type Tab = (typeof tabs)[number][0];

/**
 * My Space: a personal desk, private by default. The focus is continuing
 * work: drafts, followed problems, collaborations and what needs a reply.
 */
export default async function MySpace({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab = (tabs.find(([k]) => k === params.tab)?.[0] ?? "overview") as Tab;
  const account = hasDatabase() ? await currentAccount() : undefined;
  const refs = await catalog();
  if (!account)
    return (
      <div className="frame directory">
        <header className="editorial-head">
          <div>
            <h1>Your space on Unstuck.</h1>
            <p>Drafts, saved knowledge and collaborations, private to you.</p>
          </div>
        </header>
        <Tabs
          label="My Space"
          current={tab === "saved" ? "saved" : "overview"}
          href={(k) => `/notebook?tab=${k}`}
          tabs={[
            ["overview", "Overview"],
            ["saved", "Saved"],
          ]}
        />
        {tab === "saved" ? (
          <section className="dv-section">
            <SavedList
              catalog={refs}
              empty="Nothing saved on this device yet."
            />
          </section>
        ) : (
          <div className="empty-state">
            <h3>Choose a name to keep your work in one place.</h3>
            <p>
              You can read everything without an account. Saving on this device
              works too.
            </p>
            <Link className="button button-dark" href="/account">
              Choose a name <ArrowRight size={15} />
            </Link>
          </div>
        )}
      </div>
    );

  const [
    profile,
    entries,
    problems,
    imps,
    tests,
    spaces,
    drafts,
    follows,
    replies,
    categories,
  ] = await Promise.all([
    profileById(account.id),
    publishedEntries().then((es) => es.filter((e) => e.owner === account.id)),
    problemsBy(account.id),
    improvementsBy(account.id, account.id),
    allTests().then((ts) => ts.filter((t) => t.owner === account.id)),
    myWorkspaces(account),
    myDrafts(account),
    following(account),
    repliesToMe(account, 6, false),
    listCommunities().catch(() => []),
  ]);
  const fresh = replies.filter((r) => r.fresh);
  const followedRefs = await Promise.all(
    follows
      .slice(0, 6)
      .map(async (follow) => ({
        follow,
        ref: await followingRef(follow, account),
      })),
  );
  const show = params.show === "attention" ? "attention" : "all";
  const page = Math.max(1, Number(params.page) || 1);
  const kind = typeof params.kind === "string" ? params.kind : "";
  const stats: [string, number][] = [
    ["Experiences shared", entries.length],
    ["Problems described", problems.length],
    [
      "Improvements proposed",
      imps.proposed.filter((i) => i.status !== "draft").length,
    ],
    ["Tests completed", tests.filter((t) => t.status === "complete").length],
    [
      "Collaborations",
      imps.collaborated.length +
        spaces.filter((s) => s.role !== "owner").length,
    ],
  ];

  return (
    <div className="frame directory myspace">
      <header className="editorial-head">
        <div className="me-head">
          <span className="avatar avatar-lg" aria-hidden="true">
            {account.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <h1>Your space on Unstuck.</h1>
            <p>
              {account.name}
              {profile?.affiliation && ` · ${profile.affiliation}`}
              {" · "}
              <Link
                className="text-link"
                href={`/people/${encodeURIComponent(account.name)}`}
              >
                Public profile
              </Link>
              {" · "}
              <Link className="text-link" href="/account#profile">
                Edit
              </Link>
            </p>
          </div>
        </div>
      </header>
      <dl className="stat-row">
        {stats.map(([label, n]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{n}</dd>
          </div>
        ))}
      </dl>
      <Tabs
        label="My Space"
        current={tab}
        href={(k) => `/notebook${k === "overview" ? "" : `?tab=${k}`}`}
        tabs={tabs.map(
          ([k, l]) =>
            [k, l, k === "drafts" ? drafts.length : undefined] as const,
        )}
      />

      {tab === "overview" && (
        <div className="desk">
          {!profile?.purpose.length && (
            <section className="onboard">
              <h2>What brings you to Unstuck?</h2>
              <p className="quiet-line">
                Optional. It shapes what Discover shows you first, and you can
                change it any time.
              </p>
              <PostForm
                endpoint="/api/profile"
                submit="Save"
                done="Thanks. Discover will start with these."
              >
                <div className="chip-checks">
                  {purposes.map(([k, l]) => (
                    <label key={k}>
                      <input type="checkbox" name="purpose" value={k} />
                      <span>{l}</span>
                    </label>
                  ))}
                </div>
                <p className="field-label">Topics you’re curious about</p>
                <div className="chip-checks">
                  {categories.slice(0, 14).map((c) => (
                    <label key={c.slug}>
                      <input type="checkbox" name="interests" value={c.name} />
                      <span>{c.name}</span>
                    </label>
                  ))}
                </div>
              </PostForm>
            </section>
          )}
          <section className="desk-block">
            <h2>
              <FilePen size={16} aria-hidden="true" /> Continue a draft
            </h2>
            {drafts.length ? (
              <ul className="row-list compact">
                {drafts.slice(0, 3).map((d) => (
                  <li key={d.id}>
                    <Link href={`/new?draft=${d.id}`}>{d.title}</Link>
                    <span className="record-meta">
                      Edited {d.updated.slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="quiet-line">
                No drafts.{" "}
                <Link className="text-link" href="/new">
                  Start a contribution
                </Link>
              </p>
            )}
          </section>
          <section className="desk-block">
            <h2>
              <NotebookPen size={16} aria-hidden="true" /> Pending responses
            </h2>
            {fresh.length ? (
              <ul className="row-list compact">
                {fresh.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={
                        r.entryId.startsWith("problem~")
                          ? `/problems/${r.entryId.slice(8)}?tab=discussion`
                          : `/entries/${r.entryId}?tab=discussion`
                      }
                    >
                      {r.author} replied on {r.entryTitle}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="quiet-line">Nothing waiting for you.</p>
            )}
          </section>
          <section className="desk-block">
            <h2>
              <Target size={16} aria-hidden="true" /> Following
            </h2>
            {follows.length ? (
              <ul className="row-list compact">
                {followedRefs.map(({ follow: f, ref }) => {
                  return (
                    <li key={f.type + f.id}>
                      {ref ? (
                        <Link href={ref.href}>{ref.label}</Link>
                      ) : (
                        <span>
                          This {f.type} is no longer available to you.
                        </span>
                      )}
                      <span className="record-meta">
                        {ref?.kind ?? "Unavailable or private"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="quiet-line">
                Follow a problem or proposal to see its updates here.
              </p>
            )}
          </section>
          <section className="desk-block">
            <h2>
              <Users size={16} aria-hidden="true" /> Active collaborations
            </h2>
            {spaces.length || imps.collaborated.length ? (
              <ul className="row-list compact">
                {spaces.slice(0, 4).map((s) => (
                  <li key={s.id}>
                    <Link href={`/workspaces/${s.id}`}>{s.title}</Link>
                    <span className="record-meta">{roleLabel[s.role]}</span>
                  </li>
                ))}
                {imps.collaborated.slice(0, 3).map((i) => (
                  <li key={i.id}>
                    <Link href={`/improvements/${i.id}`}>{i.title}</Link>
                    <ProposalStatus improvement={i} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="quiet-line">
                <Link className="text-link" href="/workspaces">
                  Find a workspace
                </Link>{" "}
                or add to a proposal’s discussion.
              </p>
            )}
          </section>
          <section className="desk-block">
            <h2>
              <GitBranch size={16} aria-hidden="true" /> Recent contributions
            </h2>
            {entries.length || imps.proposed.length ? (
              <ul className="row-list compact">
                {entries.slice(0, 3).map((e) => (
                  <li key={e.id}>
                    <Link href={`/entries/${e.id}`}>{e.title}</Link>
                    <AttemptOutcome entry={e} />
                  </li>
                ))}
                {imps.proposed.slice(0, 2).map((i) => (
                  <li key={i.id}>
                    <Link href={`/improvements/${i.id}`}>{i.title}</Link>
                    <ProposalStatus improvement={i} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="quiet-line">Nothing published yet.</p>
            )}
          </section>
          <section className="desk-block">
            <h2>Recently saved</h2>
            <SavedList catalog={refs} empty="Nothing saved yet." />
          </section>
        </div>
      )}

      {tab === "contributions" && (
        <section className="dv-section">
          <nav className="seg" aria-label="Type">
            {[
              ["", "Everything"],
              ["attempts", "Attempts"],
              ["problems", "Problems"],
              ["proposals", "Proposals"],
              ["tests", "Tests"],
            ].map(([k, l]) => (
              <Link
                key={k}
                href={`/notebook?tab=contributions${k ? `&kind=${k}` : ""}`}
                aria-current={kind === k ? "true" : undefined}
              >
                {l}
              </Link>
            ))}
          </nav>
          {(!kind || kind === "problems") && problems.length > 0 && (
            <>
              <h2 className="sub-head">Problems</h2>
              <ul className="row-list">
                {problems.map((p) => (
                  <li key={p.id}>
                    <Link href={`/problems/${p.id}`}>{p.title}</Link>
                    <span className="record-meta">{p.category}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {(!kind || kind === "proposals") && imps.proposed.length > 0 && (
            <>
              <h2 className="sub-head">Proposals</h2>
              <ul className="row-list">
                {imps.proposed.map((i) => (
                  <li key={i.id}>
                    <Link href={`/improvements/${i.id}`}>{i.title}</Link>
                    <ProposalStatus improvement={i} />
                  </li>
                ))}
              </ul>
            </>
          )}
          {(!kind || kind === "tests") && tests.length > 0 && (
            <>
              <h2 className="sub-head">Tests</h2>
              <ul className="row-list">
                {tests.map((t) => (
                  <li key={t.id}>
                    <Link href={`/tests/${t.id}`}>
                      <FlaskConical size={13} aria-hidden="true" /> {t.title}
                    </Link>
                    <Pill tone={t.status === "complete" ? "worked" : "ongoing"}>
                      {testStatusLabel[t.status]}
                    </Pill>
                  </li>
                ))}
              </ul>
            </>
          )}
          {(!kind || kind === "attempts") && (
            <>
              <h2 className="sub-head">Attempts and their responses</h2>
              <nav className="seg" aria-label="Show">
                <Link
                  href="/notebook?tab=contributions&kind=attempts"
                  aria-current={show === "all" ? "true" : undefined}
                >
                  Everything
                </Link>
                <Link
                  href="/notebook?tab=contributions&kind=attempts&show=attention"
                  aria-current={show === "attention" ? "true" : undefined}
                >
                  Needs your attention
                </Link>
              </nav>
              <MyPosts
                account={account}
                filter={show}
                page={page}
                link={(n) =>
                  `/notebook?tab=contributions&kind=attempts${show === "attention" ? "&show=attention" : ""}&page=${n}`
                }
              />
            </>
          )}
        </section>
      )}

      {tab === "drafts" && (
        <section className="dv-section">
          {drafts.length ? (
            <ul className="row-list">
              {drafts.map((d) => (
                <li key={d.id}>
                  <Link href={`/new?draft=${d.id}`}>{d.title}</Link>
                  <span className="record-meta">
                    {d.kind === "problem" ? "Problem" : "Attempt"} · last edited{" "}
                    {new Date(d.updated).toLocaleString("en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="quiet-line">
              No drafts saved to your account. Contribute saves to this device
              as you type; choose “Save draft” to keep it here.
            </p>
          )}
          {imps.proposed.some((i) => i.status === "draft") && (
            <>
              <h2 className="sub-head">Draft proposals</h2>
              <ul className="row-list">
                {imps.proposed
                  .filter((i) => i.status === "draft")
                  .map((i) => (
                    <li key={i.id}>
                      <Link href={`/improvements/${i.id}`}>{i.title}</Link>
                      <span className="record-meta">Only you can see it</span>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </section>
      )}

      {tab === "saved" && (
        <section className="dv-section">
          <SavedList
            catalog={refs}
            empty="Nothing saved yet. Save problems, attempts and lessons as you read."
          />
        </section>
      )}

      {tab === "collaborations" && (
        <section className="dv-section">
          <h2 className="sub-head">Workspaces</h2>
          {spaces.length ? (
            <ul className="row-list">
              {spaces.map((s) => (
                <li key={s.id}>
                  <Link href={`/workspaces/${s.id}`}>{s.title}</Link>
                  <span className="record-meta">{roleLabel[s.role]}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="quiet-line">
              You’re not in a workspace yet.{" "}
              <Link className="text-link" href="/workspaces">
                Browse workspaces
              </Link>
            </p>
          )}
          <h2 className="sub-head">Proposals you’ve contributed to</h2>
          {imps.collaborated.length ? (
            <ul className="row-list">
              {imps.collaborated.map((i) => (
                <li key={i.id}>
                  <Link href={`/improvements/${i.id}`}>{i.title}</Link>
                  <ProposalStatus improvement={i} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="quiet-line">None yet.</p>
          )}
        </section>
      )}
    </div>
  );
}
