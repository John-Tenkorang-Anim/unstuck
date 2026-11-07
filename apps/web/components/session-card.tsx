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
          <span className="session-card-inquiry">Inquiry on a video</span>
        )}
        <span className="session-card-pins">
          {session.pins.length
            ? `${session.pins.length} pins`
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
