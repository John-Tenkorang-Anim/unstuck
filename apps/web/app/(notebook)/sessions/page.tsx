import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { SessionCard } from "@/components/session-card";
import { getNotebook } from "@/lib/api";
import { noteLabels, sampleSessions } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Critique" };

export default async function Sessions() {
  const { mode } = await getNotebook();
  const sessions = mode === "examples" ? sampleSessions : [];
  return (
    <div className="frame sessions-page">
      <header className="page-bar">
        <div>
          <h1>Critique</h1>
          <p>
            Post your work, show where it went wrong, and get specific feedback
            pinned to the exact spot.
          </p>
        </div>
        <Link href="/sessions/new" className="button button-dark">
          <Plus size={15} /> Ask for critique
        </Link>
      </header>
      {mode === "examples" && (
        <p className="example-notice">
          <span className="example-tag">Sample data</span> Fictional sessions.
          The photos are real and credited.
        </p>
      )}
      {sessions.length ? (
        <ul className="session-cards">
          {sessions.map((session) => {
            const notes = session.rounds.flatMap((r) => r.notes);
            return (
              <li key={session.id}>
                <SessionCard session={session} notes={notes.length} />
                <p className="session-card-types">
                  {[...new Set(notes.map((n) => noteLabels[n.type]))].join(
                    " · ",
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="empty-state">
          <h3>No sessions are open yet.</h3>
          <p>Sessions open to everyone once accounts are available.</p>
        </div>
      )}
    </div>
  );
}
