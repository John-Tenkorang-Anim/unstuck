import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, Plus } from "lucide-react";
import {
  branchesFor,
  Pill,
  ProgressTrail,
  RailBlock,
  Tabs,
} from "@/components/knowledge";
import { PostForm } from "@/components/record-actions";
import { JoinWorkspace, MoveItem } from "@/components/workspace-actions";
import { currentAccount } from "@/lib/auth.server";
import { problemWork } from "@/lib/problems.server";
import {
  ideaColumns,
  itemLabel,
  roleLabel,
  taskColumns,
  visibilityLabel,
  type ItemKind,
  type WorkspaceItem,
} from "@/lib/workspaces";
import {
  atLeast,
  getWorkspace,
  workspacePreview,
} from "@/lib/workspaces.server";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const found = await getWorkspace((await params).id);
  return { title: found?.workspace.title ?? "Workspace" };
}
const tabs = [
  ["overview", "Overview"],
  ["ideas", "Ideas"],
  ["tasks", "Tasks"],
  ["tests", "Tests"],
  ["evidence", "Evidence"],
  ["decisions", "Decisions"],
  ["activity", "Activity"],
] as const;
type Tab = (typeof tabs)[number][0];
const kindForTab: Partial<Record<Tab, ItemKind>> = {
  ideas: "idea",
  tasks: "task",
  tests: "test",
  evidence: "evidence",
  decisions: "decision",
};

/** A collaborative studio: wide, practical, organised around the work. */
export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewer = await currentAccount();
  const found = await getWorkspace((await params).id, viewer);
  if (!found) {
    const preview = await workspacePreview((await params).id);
    if (!preview) notFound();
    return (
      <div className="frame directory">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/workspaces">Workspaces</Link>
        </nav>
        <header className="editorial-head">
          <div>
            <p className="record-kicker">Members only</p>
            <h1>{preview.title}</h1>
            <p>
              This workspace is listed publicly. Its work, evidence and member
              list are available only to invited members.
            </p>
          </div>
        </header>
        <section className="empty-state">
          <Lock size={24} aria-hidden="true" />
          <h2>An invitation is required</h2>
          <p>
            Ask the workspace owner to add you. If you’re already a member, sign
            in with the account you were invited with.
          </p>
          <Link
            className="button button-dark"
            href={`/account?next=${encodeURIComponent(`/workspaces/${(await params).id}`)}`}
          >
            Sign in
          </Link>
        </section>
      </div>
    );
  }
  const { workspace: w, role } = found;
  const query = await searchParams;
  const tab = (tabs.find(([k]) => k === query.tab)?.[0] ?? "overview") as Tab;
  const view = query.view === "board" ? "board" : "list";
  const work = w.problemId ? await problemWork(w.problemId) : undefined;
  const items = (k: ItemKind) => w.items.filter((i) => i.kind === k);
  const href = (k: string, extra = "") =>
    `/workspaces/${w.id}${k === "overview" ? (extra ? `?${extra}` : "") : `?tab=${k}${extra ? `&${extra}` : ""}`}`;
  const canAdd = !w.sample && atLeast(role, "contributor");
  const canEdit = !w.sample && atLeast(role, "editor");
  const kind = kindForTab[tab];
  const activity = [...w.items].sort((a, b) =>
    b.updated.localeCompare(a.updated),
  );

  const addForm = (k: ItemKind) =>
    (k === "task" || k === "decision" ? canEdit : canAdd) && (
      <details className="disclosure" id="add">
        <summary>
          <Plus size={14} aria-hidden="true" /> Add {itemLabel[k].toLowerCase()}
        </summary>
        <PostForm
          endpoint={`/api/workspaces/${w.id}`}
          extra={{ kind: k }}
          submit={`Add ${itemLabel[k].toLowerCase()}`}
          done="Added."
        >
          <label className="field">
            <span>Title</span>
            <input name="title" required minLength={3} />
          </label>
          <label className="field">
            <span>{k === "decision" ? "What was decided" : "Details"}</span>
            <textarea name="body" rows={2} />
          </label>
          {k === "task" && (
            <div className="field-row">
              <label className="field">
                <span>Owner</span>
                <input name="assignee" placeholder="A member’s name" />
              </label>
              <label className="field">
                <span>Due (optional)</span>
                <input type="date" name="due" />
              </label>
            </div>
          )}
          {k === "decision" && (
            <>
              <label className="field">
                <span>Why</span>
                <textarea name="why" rows={2} required />
              </label>
              <label className="field">
                <span>Who took part (one per line)</span>
                <textarea name="participants" rows={2} />
              </label>
            </>
          )}
          <label className="field">
            <span>Related record (optional)</span>
            <input name="href" placeholder="/improvements/… or /entries/…" />
          </label>
        </PostForm>
      </details>
    );

  const itemCard = (
    i: WorkspaceItem,
    columns?: readonly (readonly [string, string])[],
  ) => (
    <li key={i.id} id={i.id} className="ws-item" data-kind={i.kind}>
      <div className="ws-item-top">
        <span className="kind-tag">{itemLabel[i.kind]}</span>
        {i.due && <span className="record-meta">Due {i.due}</span>}
        {columns &&
          canAdd &&
          (role !== "contributor" || i.by === viewer?.name) && (
            <MoveItem
              workspace={w.id}
              item={i.id}
              status={i.status}
              columns={columns}
            />
          )}
      </div>
      <strong>{i.title}</strong>
      {i.body && <p>{i.body}</p>}
      {i.why && (
        <p className="ws-why">
          <b>{i.kind === "decision" ? "Why:" : "Note:"}</b> {i.why}
        </p>
      )}
      <p className="record-meta">
        {i.assignee ? `Owner: ${i.assignee}` : `By ${i.by}`}
        {i.participants && ` · With ${i.participants.join(", ")}`}
        {i.kind === "decision" &&
          (i.open ? " · Open to revision" : " · Settled")}
        {i.link && (
          <>
            {" · "}
            <Link className="text-link" href={i.link.href}>
              {i.link.label}
            </Link>
          </>
        )}
      </p>
    </li>
  );
  const board = (k: "idea" | "task") => {
    const columns = k === "idea" ? ideaColumns : taskColumns;
    const list = items(k);
    return (
      <>
        <div className="block-head">
          <h2>{k === "idea" ? "Ideas" : "Tasks"}</h2>
          <nav className="seg" aria-label="View">
            <Link
              href={href(tab)}
              aria-current={view === "list" ? "true" : undefined}
            >
              List
            </Link>
            <Link
              href={href(tab, "view=board")}
              aria-current={view === "board" ? "true" : undefined}
            >
              Board
            </Link>
          </nav>
        </div>
        {view === "board" ? (
          <div className="board">
            {columns.map(([status, label]) => (
              <section key={status} className="board-col" aria-label={label}>
                <h3>
                  {label}{" "}
                  <span className="tab-count">
                    {list.filter((i) => i.status === status).length}
                  </span>
                </h3>
                <ul>
                  {list
                    .filter((i) => i.status === status)
                    .map((i) => itemCard(i, columns))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <ul className="ws-list">
            {list.map((i) => (
              <li key={i.id} className="ws-row">
                <span className="ws-status">
                  {columns.find(([s]) => s === i.status)?.[1]}
                </span>
                <span>
                  <strong>{i.title}</strong>
                  {i.why && <small>{i.why}</small>}
                </span>
                <span className="record-meta">
                  {i.assignee ?? i.by}
                  {i.due && ` · ${i.due}`}
                </span>
                {i.link ? (
                  <Link className="text-link" href={i.link.href}>
                    {i.link.label}
                  </Link>
                ) : (
                  <span />
                )}
              </li>
            ))}
          </ul>
        )}
        {addForm(k)}
      </>
    );
  };

  return (
    <div className="frame knowledge-page studio">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/workspaces" className="back-link">
          <ArrowLeft size={14} /> Workspaces
        </Link>
      </nav>
      {w.sample && (
        <p className="example-notice">
          <span className="example-tag">Sample data</span> A fictional
          workspace, used to show how collaboration works.
        </p>
      )}
      <header className="record-head studio-head">
        <p className="record-kicker">Workspace</p>
        <h1>{w.title}</h1>
        <p className="record-links">
          {work && (
            <>
              <span>Linked problem</span>
              <Link href={`/problems/${work.problem.id}`}>
                {work.problem.title}
              </Link>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span>{w.members.length} members</span>
          <span aria-hidden="true">·</span>
          <Pill tone={w.visibility === "public" ? "ongoing" : "quiet"}>
            {w.visibility !== "public" && <Lock size={11} aria-hidden="true" />}
            {visibilityLabel[w.visibility]}
          </Pill>
          <span aria-hidden="true">·</span>
          <span>Active {w.updated.slice(0, 10)}</span>
        </p>
        <div className="record-actions-row">
          {canAdd ? (
            <details className="pick add-menu">
              <summary className="button button-dark">
                <Plus size={15} aria-hidden="true" /> Add to workspace
              </summary>
              <div className="pick-menu">
                {(
                  ["idea", "task", "test", "evidence", "decision"] as ItemKind[]
                )
                  .filter((k) =>
                    k === "task" || k === "decision" ? canEdit : true,
                  )
                  .map((k) => (
                    <Link
                      key={k}
                      href={
                        href(
                          k === "idea"
                            ? "ideas"
                            : k === "task"
                              ? "tasks"
                              : k === "test"
                                ? "tests"
                                : k === "decision"
                                  ? "decisions"
                                  : "evidence",
                        ) + "#add"
                      }
                    >
                      {itemLabel[k]}
                    </Link>
                  ))}
              </div>
            </details>
          ) : !w.sample && !role && w.visibility === "public" ? (
            <JoinWorkspace id={w.id} />
          ) : null}
          {role && (
            <span className="record-meta">
              You’re {roleLabel[role].toLowerCase()} here
            </span>
          )}
        </div>
      </header>

      <Tabs
        label="Workspace"
        current={tab}
        href={(k) => href(k)}
        tabs={tabs.map(
          ([k, l]) =>
            [
              k,
              l,
              kindForTab[k] ? items(kindForTab[k]!).length : undefined,
            ] as const,
        )}
      />

      <div
        className={
          tab === "overview" || tab === "activity"
            ? "knowledge-grid knowledge-grid-two"
            : "knowledge-grid studio-grid"
        }
      >
        <div className="knowledge-main">
          {tab === "overview" && (
            <>
              <section className="ws-summary">
                <div>
                  <h2 className="rail-title">Goal</h2>
                  <p>{w.goal}</p>
                </div>
                {w.strategy && (
                  <div>
                    <h2 className="rail-title">Current strategy</h2>
                    <p>{w.strategy}</p>
                  </div>
                )}
                {w.progress && (
                  <div>
                    <h2 className="rail-title">Recent progress</h2>
                    <p>{w.progress}</p>
                  </div>
                )}
              </section>
              <div className="ws-two">
                <section className="prose-block">
                  <h2>Next actions</h2>
                  <ul className="dash-list">
                    {(w.next.length
                      ? w.next
                      : items("task")
                          .filter((t) => t.status !== "done")
                          .map((t) => t.title)
                    ).map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </section>
                <section className="prose-block">
                  <h2>Unresolved questions</h2>
                  {w.questions.length ? (
                    <ul className="dash-list">
                      {w.questions.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="quiet-line">None recorded.</p>
                  )}
                </section>
              </div>
              {work && (
                <section className="prose-block">
                  <h2>Where this sits</h2>
                  <ProgressTrail
                    problem={work.problem}
                    branches={branchesFor(
                      work.attempts,
                      work.improvements,
                      work.tests,
                    )}
                    compact
                  />
                </section>
              )}
            </>
          )}
          {tab === "ideas" && (
            <section className="prose-block">{board("idea")}</section>
          )}
          {tab === "tasks" && (
            <section className="prose-block">{board("task")}</section>
          )}
          {kind && kind !== "idea" && kind !== "task" && (
            <section className="prose-block">
              <h2>{tabs.find(([k]) => k === tab)?.[1]}</h2>
              {kind === "evidence" && (
                <p className="quiet-line">
                  Every item stays connected to the claim, attempt, proposal or
                  test it supports.
                </p>
              )}
              {kind === "decision" && (
                <p className="quiet-line">
                  What was decided and why, so the reasoning doesn’t disappear
                  into long threads.
                </p>
              )}
              {items(kind).length === 0 && (
                <p className="quiet-line">Nothing here yet.</p>
              )}
              <ul className="ws-items">
                {items(kind).map((i) => itemCard(i))}
              </ul>
              {addForm(kind)}
            </section>
          )}
          {tab === "activity" && (
            <section className="prose-block">
              <h2>Activity</h2>
              <ol className="history">
                {activity.map((i) => (
                  <li key={i.id}>
                    <time dateTime={i.updated}>{i.updated.slice(0, 10)}</time>
                    <span>
                      <b>{i.by}</b>{" "}
                      {i.created === i.updated ? "added" : "updated"}{" "}
                      {itemLabel[i.kind].toLowerCase()} “{i.title}”
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
        <aside
          className="knowledge-rail"
          hidden={!(tab === "overview" || tab === "activity")}
        >
          <RailBlock title="Members">
            <ul className="people">
              {w.members.map((m) => (
                <li key={m.name}>
                  <span className="avatar" aria-hidden="true">
                    {m.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="person">
                    <Link href={`/people/${encodeURIComponent(m.name)}`}>
                      {m.name}
                    </Link>
                    {m.focus && <small>{m.focus}</small>}
                  </span>
                  <small>{roleLabel[m.role]}</small>
                </li>
              ))}
            </ul>
          </RailBlock>
          {role === "owner" && (
            <RailBlock title="Add or change a member">
              <PostForm
                endpoint={`/api/workspaces/${w.id}`}
                extra={{ action: "role" }}
                submit="Save"
                done="Member updated."
                className="steer"
              >
                <label className="field">
                  <span>Their name</span>
                  <input
                    name="name"
                    required
                    placeholder="Name or public profile link"
                  />
                </label>
                <label className="field">
                  <span>Role</span>
                  <select name="role">
                    <option value="contributor">Contributor</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </label>
              </PostForm>
            </RailBlock>
          )}
          <RailBlock title="Publishing">
            <p className="rail-text">
              The problem page stays the public record. Work here becomes public
              only when its contributors publish it as an attempt, proposal or
              test.
            </p>
          </RailBlock>
        </aside>
      </div>
    </div>
  );
}
