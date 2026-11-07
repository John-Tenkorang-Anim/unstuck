import type { Metadata } from "next";
import Link from "next/link";
import { ModerationActions } from "@/components/moderation-actions";
import { currentAccount } from "@/lib/auth.server";
import { hasDatabase } from "@/lib/db.server";
import { ActionForm } from "@/components/action-form";
import { hashListConfigured } from "@/lib/hashlist.server";
import {
  AUTO_HIDE_REPORTS,
  moderationQueue,
  openAppeals,
  openIncidents,
  preview,
} from "@/lib/store.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Moderation",
  robots: { index: false },
};

export default async function Moderation() {
  const account = hasDatabase() ? await currentAccount() : undefined;
  if (!account?.moderator)
    return (
      <div className="frame account-page">
        <div className="empty-state">
          <h3>Moderators only.</h3>
          <p>
            If you help run this site, enter the moderator code on{" "}
            <Link className="text-link" href="/account">
              your account page
            </Link>
            .
          </p>
        </div>
      </div>
    );
  const { reports, files, actions } = await moderationQueue();
  const incidents = await openIncidents();
  const appeals = await openAppeals();
  const unreported = incidents.filter((i) => !i.reported_at);
  const items = await Promise.all(
    reports.map(async (r) => ({
      ...r,
      preview: await preview(r.target_type, r.target_id),
    })),
  );
  const href = (type: string, id: string, sessionId?: string) =>
    type === "session"
      ? `/sessions/${id}`
      : type === "entry"
        ? `/entries/${id}`
        : `/sessions/${sessionId}#note-${id}`;
  return (
    <div className="frame moderation">
      <header className="page-bar">
        <div>
          <h1>Moderation</h1>
          <p>
            Content is hidden automatically after {AUTO_HIDE_REPORTS} reports
            from different people. Every decision is logged with its reason.
          </p>
        </div>
      </header>
      {incidents.length > 0 && (
        <section aria-labelledby="incidents-title" className="incidents">
          <h2 id="incidents-title" className="mod-heading">
            Matched known abuse imagery{" "}
            <span>{unreported.length} to report</span>
          </h2>
          <p className="incident-guide">
            These uploads matched the hash list. The files are quarantined and
            are never shown, to anyone, including moderators. The accounts are
            suspended. Report each one to the authority where you operate: in
            the United States, the NCMEC CyberTipline (report.cybertip.org); in
            the UK, the IWF; elsewhere, your national hotline through INHOPE
            (inhope.org). Keep the quarantined file as evidence, then record the
            report reference here.
          </p>
          <ul className="mod-list">
            {incidents.map((incident) => (
              <li
                key={incident.id}
                className={`mod-item ${incident.reported_at ? "" : "is-urgent"}`}
              >
                <div className="mod-item-head">
                  <span className="mod-type">
                    {incident.reported_at ? "Reported" : "Not yet reported"}
                  </span>
                  <span>
                    Account {incident.account} · matched “{incident.matched}” at
                    distance {incident.distance} ·{" "}
                    {incident.created
                      .toISOString()
                      .slice(0, 16)
                      .replace("T", " ")}
                  </span>
                </div>
                {incident.reported_at ? (
                  <p className="mod-meta">
                    Report reference: {incident.report_reference}
                  </p>
                ) : (
                  <ActionForm
                    endpoint={`/api/incidents/${incident.id}/report`}
                    field="reference"
                    label="Report reference"
                    min={3}
                    placeholder="Report reference from the hotline"
                    buttons={[{ label: "Record report" }]}
                    done="Recorded."
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-labelledby="appeals-title">
        <h2 id="appeals-title" className="mod-heading">
          Appeals <span>{appeals.length}</span>
        </h2>
        {appeals.length ? (
          <ul className="mod-list">
            {appeals.map((appeal) => (
              <li key={appeal.id} className="mod-item">
                <div className="mod-item-head">
                  <span className="mod-type">
                    {
                      {
                        account: "Suspension",
                        session: "Hidden session",
                        note: "Hidden note",
                        entry: "Hidden field note",
                      }[appeal.target_type]
                    }
                  </span>
                  <span>from {appeal.appellant_name}</span>
                </div>
                {(appeal.target_type === "session" ||
                  appeal.target_type === "entry") && (
                  <Link
                    className="mod-title"
                    href={
                      appeal.target_type === "session"
                        ? `/sessions/${appeal.target_id}`
                        : `/entries/${appeal.target_id}`
                    }
                  >
                    Open the{" "}
                    {appeal.target_type === "entry" ? "field note" : "session"}
                  </Link>
                )}
                <p className="mod-meta">{appeal.reason}</p>
                <blockquote className="appeal-statement">
                  {appeal.statement}
                </blockquote>
                <ActionForm
                  endpoint={`/api/appeals/${appeal.id}/decide`}
                  field="note"
                  label="Explain your decision"
                  min={10}
                  placeholder="Explain your decision to the person (at least 10 characters)"
                  buttons={[
                    { label: "Overturn", extra: { decision: "overturn" } },
                    {
                      label: "Uphold",
                      extra: { decision: "uphold" },
                      tone: "danger",
                    },
                  ]}
                  done="Decided."
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="quiet-notice">No open appeals.</p>
        )}
      </section>
      <section aria-labelledby="reports-title">
        <h2 id="reports-title" className="mod-heading">
          Reports <span>{reports.length}</span>
        </h2>
        {items.length ? (
          <ul className="mod-list">
            {items.map((item) => (
              <li key={item.target_type + item.target_id} className="mod-item">
                <div className="mod-item-head">
                  <span className="mod-type">
                    {
                      { entry: "Field note", session: "Session", note: "Note" }[
                        item.target_type
                      ]
                    }
                  </span>
                  <span>
                    {item.count} {item.count === 1 ? "report" : "reports"}
                  </span>
                  {item.preview?.hidden && (
                    <span className="mod-hidden">Hidden</span>
                  )}
                </div>
                {item.preview ? (
                  <>
                    <Link
                      className="mod-title"
                      href={href(
                        item.target_type,
                        item.target_id,
                        item.preview.sessionId,
                      )}
                    >
                      {item.preview.title.slice(0, 160) || "Untitled"}
                    </Link>
                    <p className="mod-meta">By {item.preview.ownerName}</p>
                  </>
                ) : (
                  <p className="mod-meta">This content no longer exists.</p>
                )}
                <ul className="mod-reasons">
                  {item.reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
                <ModerationActions
                  choices={[
                    {
                      action: "dismiss",
                      label: "Dismiss reports",
                      type: item.target_type,
                      id: item.target_id,
                    },
                    item.preview?.hidden
                      ? {
                          action: "restore",
                          label: "Restore",
                          type: item.target_type,
                          id: item.target_id,
                        }
                      : {
                          action: "hide",
                          label: "Hide",
                          type: item.target_type,
                          id: item.target_id,
                        },
                    ...(item.preview
                      ? [
                          {
                            action: "suspend",
                            label: "Suspend author",
                            type: "account",
                            id: item.preview.owner,
                            tone: "danger" as const,
                          },
                        ]
                      : []),
                  ]}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="quiet-notice">No open reports.</p>
        )}
      </section>
      <section aria-labelledby="uploads-title">
        <h2 id="uploads-title" className="mod-heading">
          Uploads waiting for review <span>{files.length}</span>
        </h2>
        {files.length ? (
          <ul className="mod-list mod-files">
            {files.map((file) => (
              <li key={file.id} className="mod-item">
                <div className="mod-file">
                  {file.mime.startsWith("image/") ? (
                    <img
                      src={`/api/files/${file.id}`}
                      alt={`Upload by ${file.owner_name}`}
                    />
                  ) : (
                    <a
                      className="text-link"
                      href={`/api/files/${file.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open the{" "}
                      {file.mime === "application/pdf" ? "PDF" : "video"}
                    </a>
                  )}
                </div>
                <p className="mod-meta">
                  {file.name} · {Math.round(file.bytes / 1024)} KB · by{" "}
                  {file.owner_name}
                  {file.scan ? ` · ${file.scan}` : ""}
                </p>
                <ModerationActions
                  choices={[
                    {
                      action: "approve-file",
                      label: "Approve",
                      type: "file",
                      id: file.id,
                    },
                    {
                      action: "reject-file",
                      label: "Reject",
                      type: "file",
                      id: file.id,
                      tone: "danger",
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="quiet-notice">Nothing waiting.</p>
        )}
      </section>
      <section aria-labelledby="hashes-title">
        <h2 id="hashes-title" className="mod-heading">
          Hash list
        </h2>
        {hashListConfigured() ? (
          <div className="mod-item">
            <p className="mod-meta">
              Every uploaded photo is hashed with PDQ and checked against the
              list in UNSTUCK_HASH_LIST. When the list changes, check earlier
              uploads again.
            </p>
            <ActionForm
              endpoint="/api/moderation/recheck"
              buttons={[{ label: "Check every upload again" }]}
            />
          </div>
        ) : (
          <p className="quiet-notice">
            No hash list is configured. Join an industry hash-sharing programme
            and set UNSTUCK_HASH_LIST to its PDQ file. Photos are still hashed
            now, so they can be checked when a list is added.
          </p>
        )}
      </section>
      <section aria-labelledby="log-title">
        <h2 id="log-title" className="mod-heading">
          Recent decisions
        </h2>
        {actions.length ? (
          <ul className="mod-log">
            {actions.map((a, i) => (
              <li key={i}>
                <strong>{a.action}</strong> {a.target_type} by {a.moderator} ·{" "}
                {a.created.toISOString().slice(0, 16).replace("T", " ")}
                <span>{a.note}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="quiet-notice">No decisions yet.</p>
        )}
      </section>
    </div>
  );
}
