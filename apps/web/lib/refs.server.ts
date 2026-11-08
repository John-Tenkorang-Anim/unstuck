import "server-only";
import { getNotebook } from "./api";
import { allImprovements } from "./improvements.server";
import { listProblems } from "./problems.server";
import { allTests } from "./tests.server";
import { lessonLabel } from "./types";
import type { FollowType } from "./follows.server";
import type { Account } from "./store.server";
import { profileById, profileByName } from "./profile.server";
import { communityBySlug } from "./communities.server";
import { getWorkspace, workspacePreview } from "./workspaces.server";
import { getProblem } from "./problems.server";
import { getImprovement } from "./improvements.server";

export interface Ref {
  label: string;
  href: string;
  kind: string;
}

/** Resolve only records this reader follows, respecting each record’s visibility. */
export async function followingRef(
  follow: { type: FollowType; id: string },
  viewer: Account,
): Promise<Ref | undefined> {
  const { type, id } = follow;
  if (type === "person") {
    const person =
      (await profileByName(`p_${id}`)) ??
      (/^[0-9a-f-]{36}$/.test(id) ? await profileById(id) : undefined);
    return person
      ? {
          label: person.name,
          href: `/people/p_${person.publicId}`,
          kind: "Person",
        }
      : undefined;
  }
  if (type === "category") {
    const category = await communityBySlug(id);
    return category
      ? {
          label: category.name,
          href: `/communities/${category.slug}`,
          kind: "Community",
        }
      : undefined;
  }
  if (type === "workspace") {
    const found = await getWorkspace(id, viewer);
    const preview = found?.workspace ?? (await workspacePreview(id));
    return preview
      ? { label: preview.title, href: `/workspaces/${id}`, kind: "Workspace" }
      : undefined;
  }
  if (type === "problem") {
    const problem = await getProblem(id);
    return problem
      ? { label: problem.title, href: `/problems/${id}`, kind: "Problem" }
      : undefined;
  }
  const proposal = await getImprovement(id, viewer.id);
  return proposal
    ? { label: proposal.title, href: `/improvements/${id}`, kind: "Proposal" }
    : undefined;
}
/**
 * Every record a lesson, pattern or saved item can point at, by id: attempts,
 * problems, proposals, tests and individual lessons.
 */
export async function catalog(): Promise<Record<string, Ref>> {
  const [notebook, problems, improvements, tests] = await Promise.all([
    getNotebook(),
    listProblems(),
    allImprovements(300),
    allTests(),
  ]);
  const out: Record<string, Ref> = {};
  for (const e of notebook.entries) {
    out[e.id] = { label: e.title, href: `/entries/${e.id}`, kind: "Attempt" };
    (e.lessons ?? []).forEach((l, i) => {
      out[`lesson:${e.id}:${i}`] = {
        label: l.text,
        href: `/entries/${e.id}?tab=lessons`,
        kind: `Lesson · ${lessonLabel[l.kind]}`,
      };
    });
  }
  for (const p of problems) {
    const ref = { label: p.title, href: `/problems/${p.id}`, kind: "Problem" };
    out[p.id] = ref;
    out[`problem:${p.id}`] = ref;
  }
  for (const i of improvements) {
    const ref = {
      label: i.title,
      href: `/improvements/${i.id}`,
      kind: "Proposal",
    };
    out[i.id] = ref;
    out[`improvement:${i.id}`] = ref;
  }
  for (const t of tests)
    out[t.id] = { label: t.title, href: `/tests/${t.id}`, kind: "Test" };
  return out;
}
