import type { Metadata } from "next";
import Link from "next/link";
import { AtSign, Bell, ClipboardCheck } from "lucide-react";
import { Tabs } from "@/components/knowledge";
import { activityFor, type ActivityItem } from "@/lib/activity.server";
import { currentAccount } from "@/lib/auth.server";
import { hasDatabase } from "@/lib/db.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Activity" };
const tabs = [
  ["all", "All"],
  ["mention", "Mentions"],
  ["update", "Updates"],
  ["review", "Reviews"],
] as const;
const icon = { mention: AtSign, update: Bell, review: ClipboardCheck };

/** An inbox for what changed in things you care about, grouped by what it’s about. */
export default async function Activity({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab = tabs.find(([k]) => k === params.tab)?.[0] ?? "all";
  const account = hasDatabase() ? await currentAccount() : undefined;
  const items = account ? await activityFor(account) : [];
  const shown = tab === "all" ? items : items.filter((i) => i.kind === tab);
  const groups = new Map<string, ActivityItem[]>();
  for (const i of shown)
    groups.set(i.group, [...(groups.get(i.group) ?? []), i]);
  return (
    <div className="frame directory">
      <header className="editorial-head">
        <div>
          <h1>Activity</h1>
          <p>
            Replies to you, changes to what you follow, and things that need
            your answer.
          </p>
        </div>
      </header>
      <Tabs
        label="Activity"
        current={tab}
        href={(k) => `/activity${k === "all" ? "" : `?tab=${k}`}`}
        tabs={tabs.map(
          ([k, l]) =>
            [
              k,
              l,
              k === "all"
                ? undefined
                : items.filter((i) => i.kind === k).length,
            ] as const,
        )}
      />
      {!account ? (
        <div className="empty-state">
          <h3>Choose a name to get updates.</h3>
          <p>
            Follow problems and proposals, and you’ll see what changes here.
          </p>
          <Link className="button button-dark" href="/account">
            Choose a name
          </Link>
        </div>
      ) : shown.length === 0 ? (
        <div className="empty-state">
          <h3>All quiet.</h3>
          <p>
            Follow a problem or proposal to hear when someone proposes, tests or
            answers.
          </p>
          <Link className="button button-outline" href="/problems">
            Browse problems
          </Link>
        </div>
      ) : (
        <div className="inbox">
          {[...groups].map(([group, list]) => (
            <section key={group} className="inbox-group" aria-label={group}>
              <h2>{group}</h2>
              <ul>
                {list.map((i, n) => {
                  const Icon = icon[i.kind];
                  return (
                    <li key={n} data-fresh={i.fresh || undefined}>
                      <Icon size={15} aria-hidden="true" />
                      <Link href={i.href}>
                        <strong>{i.title}</strong>
                        <span>{i.detail}</span>
                      </Link>
                      <time dateTime={i.at}>{i.at.slice(0, 10)}</time>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      <p className="tab-note">
        Updates appear here and under the bell. Unstuck doesn’t send email.
      </p>
    </div>
  );
}
