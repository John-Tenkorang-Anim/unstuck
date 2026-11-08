import Link from "next/link";
import { Play } from "lucide-react";
import { clock } from "@/lib/search";
import type { Community } from "@/lib/communities";
import type { EntrySummary } from "@/lib/types";
import { OutcomeBadge, SaveButton } from "./entry-card";

const number = (n: number) => n.toLocaleString("en");
const day = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
  });

/**
 * One attempt in the Discover feed: what happened, where, and how many people
 * tried it or responded. The whole row opens the note; save and the community
 * link sit above that target.
 */
export function FeedRow({
  entry,
  responses,
  community,
}: {
  entry: EntrySummary;
  responses: number;
  community?: Community;
}) {
  const picture = entry.clip?.poster ?? entry.cover;
  const question = entry.kind === "problem";
  return (
    <article className="feed-row" data-outcome={entry.outcome ?? "open"}>
      <div className="feed-main">
        <p className="feed-meta">
          <OutcomeBadge outcome={entry.outcome} />
          <span>{entry.topic}</span>
          {community && (
            <Link
              className="feed-community"
              href={`/communities/${community.slug}`}
            >
              {community.name}
            </Link>
          )}
          <span>{day(entry.date)}</span>
        </p>
        <h3>
          <Link className="feed-link" href={`/entries/${entry.id}`}>
            {entry.title}
          </Link>
        </h3>
        <p className="feed-excerpt">{entry.excerpt}</p>
        <p className="feed-stats">
          {question ? (
            <span className={responses ? "" : "feed-waiting"}>
              {responses
                ? `${number(responses)} ${responses === 1 ? "response" : "responses"}`
                : "Waiting for an answer"}
            </span>
          ) : (
            <>
              <span>{number(entry.tried)} tried it</span>
              <span>
                {number(responses)} {responses === 1 ? "response" : "responses"}
              </span>
            </>
          )}
          <span>{entry.place}</span>
          <span className="feed-save">
            <SaveButton id={entry.id} compact />
          </span>
        </p>
      </div>
      {picture && (
        <div className="feed-thumb" aria-hidden="true">
          <img
            src={picture.small}
            alt=""
            width={picture.width}
            height={picture.height}
            loading="lazy"
            decoding="async"
          />
          {entry.clip && (
            <span className="serp-time">
              <Play size={10} /> {clock(entry.clip.duration)}
            </span>
          )}
        </div>
      )}
    </article>
  );
}
