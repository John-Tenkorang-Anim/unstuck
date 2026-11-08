import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AttemptOutcome,
  Pill,
  ProposalStatus,
  Tabs,
} from "@/components/knowledge";
import { RecordActions } from "@/components/record-actions";
import { getNotebook } from "@/lib/api";
import { currentAccount } from "@/lib/auth.server";
import { hasDatabase } from "@/lib/db.server";
import { isFollowing } from "@/lib/follows.server";
import { allImprovements } from "@/lib/improvements.server";
import { listProblems } from "@/lib/problems.server";
import { profileByName } from "@/lib/profile.server";
import { testStatusLabel } from "@/lib/tests";
import { allTests } from "@/lib/tests.server";
import { sampleWorkspaces } from "@/lib/workspaces";
import { publicWorkspacesBy } from "@/lib/workspaces.server";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  return { title: decodeURIComponent((await params).name) };
}
const tabs = [
  ["contributions", "Contributions"],
  ["improvements", "Improvements"],
  ["impact", "Impact"],
  ["about", "About"],
] as const;
type Tab = (typeof tabs)[number][0];

/**
 * A contributor’s public page: what they shared and helped improve, with
 * their role on each. Counts describe contributions, never a person’s worth.
 */
export default async function Person({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const handle = decodeURIComponent((await params).name);
  const query = await searchParams;
  const tab = (tabs.find(([k]) => k === query.tab)?.[0] ??
    "contributions") as Tab;
  const [profile, notebook, improvements, tests, problems, viewer] =
    await Promise.all([
      profileByName(handle),
      getNotebook(),
      allImprovements(300),
      allTests(),
      listProblems(),
      currentAccount(),
    ]);
  const name = profile?.name ?? handle;
  const attempts = notebook.entries.filter(
    (e) =>
      (profile ? e.owner === profile.id : e.example && e.alias === name) &&
      e.kind !== "problem",
  );
  const asked = problems.filter((p) =>
    profile ? p.owner === profile.id : p.sample && p.author === name,
  );
  const proposed = improvements.filter(
    (i) =>
      (profile ? i.owner === profile.id : i.sample && i.author === name) &&
      i.status !== "draft",
  );
  const helped = improvements.filter((i) =>
    profile
      ? i.owner !== profile.id && i.events.some((e) => e.actorId === profile.id)
      : i.sample && i.author !== name && i.collaborators.includes(name),
  );
  const ran = tests.filter((t) =>
    profile ? t.owner === profile.id : t.sample && t.author === name,
  );
  const builtOn = improvements.filter(
    (i) => i.author !== name && attempts.some((a) => a.id === i.entryId),
  );
  const spaces = profile
    ? await publicWorkspacesBy(profile.id)
    : sampleWorkspaces.filter((w) => w.members.some((m) => m.name === name));
  if (
    !profile &&
    !attempts.length &&
    !proposed.length &&
    !helped.length &&
    !ran.length &&
    !asked.length
  )
    notFound();
  const sample = !profile;
  const following = profile
    ? await isFollowing(viewer, "person", profile.publicId)
    : false;
  const href = (k: string) =>
    `/people/${encodeURIComponent(handle)}${k === "contributions" ? "" : `?tab=${k}`}`;
  return (
    <div className="frame directory person-page">
      {sample && (
        <p className="example-notice" style={{ marginTop: 22 }}>
          <span className="example-tag">Sample data</span> A fictional
          contributor from the examples.
        </p>
      )}
      <header className="person-head">
        <span className="avatar avatar-xl" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h1>{name}</h1>
          <p className="record-meta">
            {[profile?.role, profile?.affiliation]
              .filter(Boolean)
              .join(" · ") || (sample ? "Contributor" : "")}
          </p>
          {profile?.bio && <p className="person-bio">{profile.bio}</p>}
          {profile?.interests.length ? (
            <ul className="need-list">
              {profile.interests.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : null}
        </div>
        {profile && viewer?.id !== profile.id && (
          <RecordActions
            follow={{
              type: "person",
              id: profile.publicId,
              following,
              enabled: hasDatabase(),
            }}
          />
        )}
      </header>
      <Tabs label="Profile" current={tab} href={href} tabs={tabs} />

      {tab === "contributions" && (
        <section className="dv-section">
          {asked.length > 0 && (
            <>
              <h2 className="sub-head">Problems described</h2>
              <ul className="row-list">
                {asked.map((p) => (
                  <li key={p.id}>
                    <Link href={`/problems/${p.id}`}>{p.title}</Link>
                    <span className="record-meta">Original author</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <h2 className="sub-head">Attempts</h2>
          {attempts.length ? (
            <ul className="row-list">
              {attempts.map((e) => (
                <li key={e.id}>
                  <Link href={`/entries/${e.id}`}>{e.title}</Link>
                  <AttemptOutcome entry={e} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="quiet-line">No attempts shared yet.</p>
          )}
        </section>
      )}
      {tab === "improvements" && (
        <section className="dv-section">
          <ul className="row-list">
            {proposed.map((i) => (
              <li key={i.id}>
                <Link href={`/improvements/${i.id}`}>{i.title}</Link>
                <span className="role-line">
                  <span className="record-meta">Proposer</span>{" "}
                  <ProposalStatus improvement={i} />
                </span>
              </li>
            ))}
            {helped.map((i) => (
              <li key={i.id}>
                <Link href={`/improvements/${i.id}`}>{i.title}</Link>
                <span className="role-line">
                  <span className="record-meta">Collaborator</span>{" "}
                  <ProposalStatus improvement={i} />
                </span>
              </li>
            ))}
            {ran.map((t) => (
              <li key={t.id}>
                <Link href={`/tests/${t.id}`}>{t.title}</Link>
                <span className="role-line">
                  <span className="record-meta">Experimenter</span>{" "}
                  <Pill tone={t.status === "complete" ? "worked" : "ongoing"}>
                    {testStatusLabel[t.status]}
                  </Pill>
                </span>
              </li>
            ))}
          </ul>
          {!proposed.length && !helped.length && !ran.length && (
            <p className="quiet-line">Nothing here yet.</p>
          )}
        </section>
      )}
      {tab === "impact" && (
        <section className="dv-section">
          <dl className="stat-row">
            {(
              [
                ["Attempts others built on", builtOn.length],
                [
                  "Improvements tested",
                  proposed.filter(
                    (i) => i.status === "testing" || i.status === "evaluated",
                  ).length,
                ],
                ["Tests run", ran.length],
                ["Collaborative projects", spaces.length + helped.length],
              ] as const
            ).map(([l, n]) => (
              <div key={l}>
                <dt>{l}</dt>
                <dd>{n}</dd>
              </div>
            ))}
          </dl>
          {builtOn.length > 0 && (
            <>
              <h2 className="sub-head">Follow-on work</h2>
              <ul className="row-list">
                {builtOn.map((i) => (
                  <li key={i.id}>
                    <Link href={`/improvements/${i.id}`}>{i.title}</Link>
                    <span className="record-meta">by {i.author}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="aside-note">
            These describe what happened to someone’s contributions. They aren’t
            a measure of expertise or worth, and an idea associated with a
            profile isn’t owned by it.
          </p>
        </section>
      )}
      {tab === "about" && (
        <section className="dv-section prose-block">
          {profile?.bio ? (
            <p>{profile.bio}</p>
          ) : (
            <p className="quiet-line">No biography yet.</p>
          )}
          {profile?.links.length ? (
            <ul className="row-list">
              {profile.links.map((l) => (
                <li key={l}>
                  <a
                    href={l}
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                  >
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          {profile && (
            <p className="record-meta">On Unstuck since {profile.created}</p>
          )}
        </section>
      )}
    </div>
  );
}
