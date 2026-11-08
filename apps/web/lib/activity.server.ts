import "server-only";
import { hasDatabase, query } from "./db.server";
import { getNotebook } from "./api";
import { myPosts, repliesToMe } from "./discussion.server";
import { following } from "./follows.server";
import { allImprovements } from "./improvements.server";
import { needsAnswer, statusLabel } from "./improvements";
import { allTests } from "./tests.server";
import type { Account } from "./store.server";

export type ActivityKind = "mention" | "update" | "review";
export interface ActivityItem {
  kind: ActivityKind;
  href: string;
  title: string;
  detail: string;
  /** What it belongs to, for grouping by problem or proposal. */
  group: string;
  at: string;
  fresh?: boolean;
}
const recent = (at: string, days = 45) =>
  Date.now() - Date.parse(at) < days * 864e5;

/**
 * What changed in things someone cares about: replies to them, updates to
 * what they follow or posted, and requests that need their answer. Nothing
 * is here just because a discussion is popular.
 */
export async function activityFor(account: Account): Promise<ActivityItem[]> {
  const [replies, posts, follows, improvements, tests, notebook] =
    await Promise.all([
      repliesToMe(account, 30, false),
      myPosts(account, { filter: "attention" }),
      following(account),
      allImprovements(300),
      allTests(),
      getNotebook(),
    ]);
  const items: ActivityItem[] = [];
  for (const r of replies) {
    const onProblem = r.entryId.startsWith("problem~");
    items.push({
      kind: "mention",
      href: onProblem
        ? `/problems/${r.entryId.slice(8)}?tab=discussion#comment-${r.parentId}`
        : `/entries/${r.entryId}?tab=discussion#comment-${r.parentId}`,
      title: `${r.author} replied to you`,
      detail: r.body.slice(0, 140),
      group: r.entryTitle,
      at: r.created,
      fresh: r.fresh,
    });
  }
  for (const p of posts.items.filter((p) => p.fresh > 0))
    items.push({
      kind: "update",
      href:
        p.kind === "entry"
          ? `/entries/${p.id}?tab=discussion`
          : `/sessions/${p.id}`,
      title: `${p.fresh} new ${p.fresh === 1 ? "response" : "responses"} on your post`,
      detail: p.title,
      group: p.title,
      at: (p.latest ?? p.created).toISOString(),
      fresh: true,
    });
  const followed = new Set(follows.map((f) => `${f.type}:${f.id}`));
  const mine = (owner?: string) => owner === account.id;
  // Public profile handles differ from private account IDs. Resolve only followed people.
  const personIds = follows
    .filter(
      (f) =>
        f.type === "person" &&
        /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(f.id),
    )
    .map((f) => f.id);
  const people =
    personIds.length && hasDatabase()
      ? await query<{ id: string; public_id: string }>(
          "SELECT id, public_id FROM web.accounts WHERE public_id = ANY($1::uuid[]) AND NOT suspended",
          [personIds],
        )
      : [];
  const personHandles = new Map(people.map((p) => [p.id, p.public_id]));
  for (const entry of notebook.entries) {
    if (entry.example || entry.owner === account.id || !recent(entry.date))
      continue;
    const targets = follows.filter(
      (f) =>
        (f.type === "person" &&
          !!entry.owner &&
          personHandles.get(entry.owner) === f.id) ||
        (f.type === "category" && entry.communities?.includes(f.id)) ||
        (f.type === "problem" && entry.problem === f.id),
    );
    if (
      !targets.some((f) => entry.date >= f.created.toISOString().slice(0, 10))
    )
      continue;
    items.push({
      kind: "update",
      href: `/entries/${entry.id}`,
      title: `New attempt from ${entry.alias}`,
      detail: entry.title,
      group: "Following",
      at: entry.date,
    });
  }
  if (hasDatabase()) {
    const updates = await query<{
      workspace: string;
      title: string;
      item: string;
      updated: Date;
    }>(
      `SELECT w.id AS workspace, w.data->>'title' AS title, i.data->>'title' AS item, i.updated
       FROM web.workspace_items i JOIN web.workspaces w ON w.id = i.workspace
       JOIN web.follows f ON f.target_type = 'workspace' AND f.target_id = w.id::text AND f.account = $1
       WHERE NOT w.hidden AND NOT i.hidden AND i.owner <> $1 AND i.updated >= f.created
       AND i.updated > now() - interval '45 days' AND (w.visibility = 'public' OR EXISTS
         (SELECT 1 FROM web.workspace_members m WHERE m.workspace = w.id AND m.account = $1))
       ORDER BY i.updated DESC LIMIT 50`,
      [account.id],
    );
    for (const update of updates)
      items.push({
        kind: "update",
        href: `/workspaces/${update.workspace}`,
        title: "Workspace updated",
        detail: update.item,
        group: update.title,
        at: update.updated.toISOString(),
      });
  }

  for (const i of improvements) {
    const watched =
      followed.has(`improvement:${i.id}`) ||
      (i.problemId && followed.has(`problem:${i.problemId}`));
    const onMyAttempt =
      i.entryId &&
      notebook.entries.find((e) => e.id === i.entryId)?.owner === account.id;
    for (const e of i.events) {
      if (
        !recent(e.created) ||
        (e.actorId ? e.actorId === account.id : e.actor === account.name)
      )
        continue;
      if (mine(i.owner) && needsAnswer(e.kind) && !e.resolved)
        items.push({
          kind: "review",
          href: `/improvements/${i.id}?tab=discussion#open-issues`,
          title: `${e.actor} raised a ${e.kind === "question" ? "question" : "concern"} on your proposal`,
          detail: e.body.slice(0, 140),
          group: i.title,
          at: e.created,
        });
      else if (
        e.kind === "created" &&
        (onMyAttempt || (i.problemId && followed.has(`problem:${i.problemId}`)))
      )
        items.push({
          kind: "update",
          href: `/improvements/${i.id}`,
          title: onMyAttempt
            ? `${e.actor} proposed an improvement to your attempt`
            : `${e.actor} proposed an improvement to a problem you follow`,
          detail: i.title,
          group: i.title,
          at: e.created,
        });
      else if (e.kind === "status" && e.to && (watched || mine(i.owner)))
        items.push({
          kind: "update",
          href: `/improvements/${i.id}`,
          title: `Moved to ${statusLabel[e.to]}`,
          detail: i.title,
          group: i.title,
          at: e.created,
        });
    }
  }
  for (const t of tests) {
    const proposal = improvements.find((i) => i.id === t.improvementId);
    if (!recent(t.updated) || t.owner === account.id) continue;
    if (
      t.findings &&
      (mine(proposal?.owner) ||
        (t.problemId && followed.has(`problem:${t.problemId}`)))
    )
      items.push({
        kind: "update",
        href: `/tests/${t.id}?tab=findings`,
        title: mine(proposal?.owner)
          ? "A test was completed for your proposal"
          : "A test was completed on a problem you follow",
        detail: t.title,
        group: proposal?.title ?? t.title,
        at: t.updated,
      });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}
