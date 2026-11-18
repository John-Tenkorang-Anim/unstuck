import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  HeartHandshake,
  MessageSquareReply,
  Send,
} from "lucide-react";
import { Tabs } from "@/components/knowledge";
import { currentAccount } from "@/lib/auth.server";
import {
  audienceLabel,
  audiences,
  helpLabel,
  helpStatusLabel,
  type HelpRequest,
} from "@/lib/help";
import { listHelp } from "@/lib/help.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Get help" };

/**
 * Get help: ask for exactly the help you need, or help someone who is where
 * you’ve been. Requests reach people with related experience, and helpers
 * are credited when it helped.
 */
export default async function Help({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (k: string) => (typeof params[k] === "string" ? params[k] : "");
  const viewer = await currentAccount();
  const tabs = [
    ["open", "Open requests"],
    ...(viewer
      ? ([
          ["for-you", "Sent to you"],
          ["yours", "Your requests"],
        ] as const)
      : []),
    ["helped", "Helped"],
  ] as const;
  const tab = tabs.find(([k]) => k === one("tab"))?.[0] ?? "open";
  const audience = audiences.find((a) => a.key === one("as"))?.key ?? "";
  const requests = await listHelp(
    {
      status: tab === "helped" ? "helped" : tab === "open" ? "open" : "",
      forMe: tab === "for-you",
      mine: tab === "yours",
      audience,
    },
    viewer,
  );
  const link = (change: Record<string, string>) => {
    const next = new URLSearchParams({
      ...(tab !== "open" ? { tab } : {}),
      ...(audience ? { as: audience } : {}),
      ...change,
    });
    for (const [k, v] of [...next]) if (!v) next.delete(k);
    return `/help${next.size ? `?${next}` : ""}`;
  };
  return (
    <div className="frame directory">
      <section className="hub-hero help-hero" aria-labelledby="help-title">
        <div>
          <h1 id="help-title">Stuck? Ask someone who’s been there.</h1>
          <p>
            Say what kind of help you need. It reaches people who’ve faced
            something similar, and they’re credited when it helps.
          </p>
        </div>
        <div className="help-ctas">
          <Link
            className="button button-dark"
            href={`/help/new${audience ? `?as=${audience}` : ""}`}
          >
            <Send size={15} aria-hidden="true" /> Ask for help
          </Link>
          {viewer && (
            <Link className="button button-outline" href="/help?tab=for-you">
              <MessageSquareReply size={15} aria-hidden="true" /> Help someone
            </Link>
          )}
        </div>
        <nav className="help-ways" aria-label="Ways in">
          {(
            [
              [
                "student",
                "Students",
                "Hints on labs, homework and projects, without being handed the answer",
              ],
              [
                "researcher",
                "Researchers",
                "Repeat a result, find a test partner, publish what didn’t work",
              ],
              [
                "engineer",
                "Engineers and makers",
                "Find someone who hit the same failure, get a second pair of eyes",
              ],
              [
                "community",
                "Communities",
                "Expertise, space or equipment for a local project",
              ],
            ] as const
          ).map(([key, label, text]) => (
            <Link
              key={key}
              href={`/for/${key === "researcher" ? "researchers" : key === "engineer" ? "engineers" : key === "student" ? "students" : "communities"}`}
            >
              <strong>{label}</strong>
              <small>{text}</small>
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </section>

      <Tabs
        label="Requests"
        current={tab}
        href={(k) => link({ tab: k === "open" ? "" : k })}
        tabs={tabs}
      />
      <nav className="dv-categories help-filter" aria-label="Who is asking">
        <Link
          href={link({ as: "" })}
          aria-current={!audience ? "true" : undefined}
        >
          Everyone
        </Link>
        {audiences.map((a) => (
          <Link
            key={a.key}
            href={link({ as: a.key })}
            aria-current={audience === a.key ? "true" : undefined}
          >
            {a.label}
          </Link>
        ))}
      </nav>
      {tab === "for-you" && (
        <p className="tab-note">
          Requests that reached you because you follow the problem or category,
          or shared something similar.
        </p>
      )}
      {requests.length === 0 ? (
        <div className="empty-state">
          <h3>
            {tab === "for-you"
              ? "Nothing sent to you yet."
              : tab === "yours"
                ? "You haven’t asked for help yet."
                : "No requests here yet."}
          </h3>
          <p>
            {tab === "for-you"
              ? "Follow a problem or a category, or share an attempt, and requests from people in a similar spot will reach you."
              : "Asking takes a minute."}
          </p>
          <Link className="button button-dark" href="/help/new">
            Ask for help
          </Link>
        </div>
      ) : (
        <ul className="help-list">
          {requests.map((r) => (
            <HelpRow key={r.id} r={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function HelpRow({ r }: { r: HelpRequest }) {
  const helped = r.offers.filter((o) => o.helped).length;
  return (
    <li>
      <Link className="help-row" href={`/help/${r.id}`}>
        <span className="help-row-top">
          <span className="kind-tag" data-kind="question">
            {helpLabel[r.kind]}
          </span>
          <span className="record-meta">
            {audienceLabel[r.audience]}
            {r.category && ` · ${r.category}`}
          </span>
          {r.graded && (
            <span className="kind-tag">Graded work · hints only</span>
          )}
          {r.sample && <span className="example-tag">Sample</span>}
        </span>
        <strong>{r.title}</strong>
        <span className="help-row-foot">
          <span
            className="pill"
            data-tone={
              r.status === "helped"
                ? "worked"
                : r.status === "open"
                  ? "ongoing"
                  : "quiet"
            }
          >
            <i aria-hidden="true" />
            {helpStatusLabel[r.status]}
          </span>
          <span>
            {r.offers.length} {r.offers.length === 1 ? "offer" : "offers"}
          </span>
          {helped > 0 && (
            <span className="help-credit">
              <HeartHandshake size={13} aria-hidden="true" /> {helped} helped
            </span>
          )}
          <span>Sent to {r.routed} people</span>
          {r.reason && <span className="help-reason">{r.reason}</span>}
        </span>
      </Link>
    </li>
  );
}
