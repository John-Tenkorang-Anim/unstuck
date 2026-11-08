import type { Metadata } from "next";
import { AccountPanel } from "@/components/account-panel";
import { currentAccount, publicAccount } from "@/lib/auth.server";
import { hasDatabase } from "@/lib/db.server";
import { ActionForm } from "@/components/action-form";
import { standing } from "@/lib/store.server";
import Link from "next/link";
import { Tabs } from "@/components/knowledge";
import { PostForm } from "@/components/record-actions";
import { profileById } from "@/lib/profile.server";
import { safeReturnTo } from "@/lib/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };
const tabs = [
  ["account", "Account"],
  ["preferences", "Preferences"],
  ["privacy", "Privacy"],
  ["notifications", "Notifications"],
  ["security", "Security"],
] as const;
const appealLabel = {
  open: "Waiting for a moderator",
  upheld: "Decision upheld",
  overturned: "Decision overturned",
};
export default async function Account({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab = tabs.find(([k]) => k === params.tab)?.[0] ?? "account";
  const account = hasDatabase() ? await currentAccount() : undefined;
  const mine = account ? await standing(account) : undefined;
  const profile = account ? await profileById(account.id) : undefined;
  return (
    <div className="frame account-page directory">
      <header className="editorial-head">
        <div>
          <h1>Settings</h1>
          <p>
            A name to post under, a recovery code to use it anywhere, and what
            you share.
          </p>
        </div>
      </header>
      <Tabs
        label="Settings"
        current={tab}
        href={(k) => `/account${k === "account" ? "" : `?tab=${k}`}`}
        tabs={tabs}
      />
      {tab === "preferences" && (
        <section className="dv-section" id="profile">
          {profile ? (
            <PostForm
              endpoint="/api/profile"
              submit="Save profile"
              done="Saved."
              className="post-form long-form"
            >
              <label className="field">
                <span>Affiliation (optional)</span>
                <input
                  name="affiliation"
                  defaultValue={profile.affiliation}
                  placeholder="A school, lab, business or group"
                />
              </label>
              <label className="field">
                <span>About you (optional)</span>
                <textarea name="bio" rows={3} defaultValue={profile.bio} />
              </label>
              <label className="field">
                <span>Interests</span>
                <small>
                  Comma-separated. Discover’s “For you” starts with these.
                </small>
                <input
                  name="interests"
                  defaultValue={profile.interests.join(", ")}
                />
              </label>
              <label className="field">
                <span>Links (optional)</span>
                <small>One per line, starting with https://</small>
                <textarea
                  name="links"
                  rows={2}
                  defaultValue={profile.links.join("\n")}
                />
              </label>
              <p className="quiet-line">
                No credentials or affiliation are needed to contribute. The
                theme and light reading switch are in the header and footer.
              </p>
            </PostForm>
          ) : (
            <p className="quiet-line">
              Choose a name first, on the Account tab.
            </p>
          )}
        </section>
      )}
      {tab === "privacy" && (
        <section className="dv-section prose-block">
          <dl className="facts">
            <div>
              <dt>Public</dt>
              <dd>
                Your name, what you publish, and the profile details you add.
                Anyone can read published contributions without an account.
              </dd>
            </div>
            <div>
              <dt>Only you</dt>
              <dd>
                Drafts, draft proposals, and the problems and proposals you
                follow.
              </dd>
            </div>
            <div>
              <dt>Only this device</dt>
              <dd>
                What you save, your in-progress contribution, and comparisons
                you’re building. They’re never sent to Unstuck.
              </dd>
            </div>
            <div>
              <dt>Workspaces</dt>
              <dd>
                Private and restricted workspaces are visible only to their
                members. Nothing there becomes public unless its contributors
                publish it.
              </dd>
            </div>
          </dl>
        </section>
      )}
      {tab === "notifications" && (
        <section className="dv-section prose-block">
          <p>
            Updates appear in{" "}
            <Link className="text-link" href="/activity">
              Activity
            </Link>{" "}
            and under the bell. Unstuck doesn’t send email.
          </p>
          <p className="quiet-line">
            You’re notified about replies to you, changes to what you follow or
            published, and questions waiting for your answer. Never because a
            discussion is popular.
          </p>
        </section>
      )}
      {(tab === "account" || tab === "security") && hasDatabase() ? (
        <AccountPanel
          returnTo={safeReturnTo(params.next)}
          initial={publicAccount(account)}
          moderationEnabled={
            (process.env.UNSTUCK_MODERATOR_CODE ?? "").length >= 12
          }
        />
      ) : null}
      {tab === "account" &&
        mine &&
        (mine.items.length > 0 || mine.appeals.length > 0) && (
          <section
            id="standing"
            className="standing"
            aria-labelledby="standing-title"
          >
            <h2 id="standing-title" className="mod-heading">
              Your standing
            </h2>
            <ul className="mod-list">
              {mine.items.map((item) => (
                <li key={item.type + item.id} className="mod-item">
                  <p className="mod-type">
                    {item.type === "account"
                      ? "Your account is suspended"
                      : `Hidden ${item.type === "entry" ? "field note" : item.type}`}
                  </p>
                  {item.type !== "account" && (
                    <p className="mod-title-plain">{item.title}</p>
                  )}
                  <p className="mod-meta">{item.reason}</p>
                  {item.appeal ? (
                    <p className="mod-meta">
                      <strong>Your appeal:</strong>{" "}
                      {appealLabel[item.appeal.status]}
                      {item.appeal.decision_note
                        ? `. “${item.appeal.decision_note}”`
                        : ""}
                    </p>
                  ) : (
                    <ActionForm
                      endpoint="/api/appeals"
                      field="statement"
                      label="Your appeal"
                      multiline
                      min={20}
                      placeholder="Explain why this decision should change (at least 20 characters). You can appeal once."
                      buttons={[
                        {
                          label: "Send appeal",
                          extra: { type: item.type, id: item.id },
                        },
                      ]}
                      done="Appeal sent. A moderator who wasn’t involved will review it."
                    />
                  )}
                </li>
              ))}
              {mine.appeals
                .filter(
                  (appeal) =>
                    !mine.items.some((item) => item.id === appeal.target_id),
                )
                .map((appeal) => (
                  <li key={appeal.id} className="mod-item">
                    <p className="mod-type">
                      Appeal about a{" "}
                      {appeal.target_type === "entry"
                        ? "field note"
                        : appeal.target_type}
                    </p>
                    <p className="mod-meta">
                      {appealLabel[appeal.status]}
                      {appeal.decision_note
                        ? `. “${appeal.decision_note}”`
                        : ""}
                    </p>
                  </li>
                ))}
            </ul>
          </section>
        )}
      {!hasDatabase() && (
        <div className="empty-state">
          <h3>Accounts need a database.</h3>
          <p>Run npm run db:start and set DATABASE_URL to turn on sharing.</p>
        </div>
      )}
    </div>
  );
}
