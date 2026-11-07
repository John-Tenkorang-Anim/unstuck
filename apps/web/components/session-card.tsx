import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { statusLabels, type Session } from "@/lib/sessions";

export function SessionCard({
  session,
  notes,
}: {
  session: Session;
  notes: number;
}) {
  return (
    <Link className="session-card" href={`/sessions/${session.id}`}>
      <span className="session-card-media">
        {session.work ? (
          <img
            src={session.work.small}
            alt=""
            width={session.work.width}
            height={session.work.height}
            loading="lazy"
          />
        ) : (
          <span className="session-card-inquiry">{describeWork(session)}</span>
        )}
        <span className="session-card-pins">
          {session.pins.length
            ? `${session.pins.length} pins`
            : session.blocks
              ? session.mode === "hints"
                ? "Hints only"
                : "Full review"
              : "Video moments"}
        </span>
      </span>
      <span className="session-card-body">
        <span className="session-card-meta">
          <span data-status={session.status}>
            {statusLabels[session.status]}
          </span>
          {session.specialty}
        </span>
        <strong>{session.title}</strong>
        <span className="session-card-ask">{session.ask}</span>
        <span className="session-card-foot">
          {notes} notes · {session.level}
          <ArrowUpRight size={15} />
        </span>
      </span>
    </Link>
  );
}

function describeWork(session: Session) {
  const block = session.blocks?.[0];
  if (session.pdf) return "PDF of the work";
  if (session.clip && !session.entryId) return "Video of the work";
  if (!block) return "Inquiry on a video";
  if (block.kind === "steps")
    return `Worked solution · ${block.steps.length} steps`;
  if (block.kind === "code")
    return `${block.language} · ${block.code.split("\n").length} lines`;
  return `Data · ${block.csv.trim().split("\n").length - 1} rows`;
}
