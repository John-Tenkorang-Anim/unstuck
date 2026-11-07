import type { Metadata } from "next";
import { AccountPanel } from "@/components/account-panel";
import { currentAccount, publicAccount } from "@/lib/auth.server";
import { hasDatabase } from "@/lib/db.server";
import { ActionForm } from "@/components/action-form";
import { standing } from "@/lib/store.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your account" };
const appealLabel = {
  open: "Waiting for a moderator",
  upheld: "Decision upheld",
  overturned: "Decision overturned",
};
export default async function Account() {
  const account = hasDatabase() ? await currentAccount() : undefined;
  const mine = account ? await standing(account) : undefined;
  return (
    <div className="frame account-page">
      <header className="page-bar">
        <div>
          <h1>Your account</h1>
          <p>
            A name to post under, and a recovery code to use it on any device.
          </p>
        </div>
      </header>
      {hasDatabase() ? (
        <AccountPanel
          initial={publicAccount(account)}
          moderationEnabled={
            (process.env.UNSTUCK_MODERATOR_CODE ?? "").length >= 12
          }
        />
      ) : null}
      {mine && (mine.items.length > 0 || mine.appeals.length > 0) && (
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
                    {appeal.decision_note ? `. “${appeal.decision_note}”` : ""}
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
