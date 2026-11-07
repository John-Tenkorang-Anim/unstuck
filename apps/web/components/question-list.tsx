import Link from "next/link";
import { MessageCircleQuestion } from "lucide-react";
import { outcomeLabels } from "@/lib/data";
import type { QuestionItem } from "@/lib/questions.server";
import type { EntrySummary } from "@/lib/types";
import { OutcomeGlyph } from "./glyph";

const number = (n: number) => n.toLocaleString("en");
const day = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString(
    "en",
    { day: "numeric", month: "short" },
  );

/** Open questions as a scannable list: how many answers, what it is, where it was asked. */
export function QuestionList({
  items,
  hideCommunity,
}: {
  items: QuestionItem[];
  hideCommunity?: string;
}) {
  return (
    <ol className="q-list">
      {items.map(({ entry, responses, latest, communities }) => (
        <li
          key={entry.id}
          className="q-row"
          data-answered={responses > 0 || undefined}
        >
          <div
            className="q-count"
            aria-label={`${number(responses)} ${responses === 1 ? "response" : "responses"}`}
          >
            <strong>{number(responses)}</strong>
            <span>{responses === 1 ? "response" : "responses"}</span>
          </div>
          <div className="q-main">
            <h3>
              <Link href={`/entries/${entry.id}`}>{entry.title}</Link>
            </h3>
            <p className="q-excerpt">{entry.excerpt}</p>
            <p className="q-meta">
              {communities
                .filter((c) => c.slug !== hideCommunity)
                .map((c) => (
                  <Link
                    key={c.slug}
                    href={`/communities/${c.slug}`}
                    className="q-community"
                  >
                    {c.name}
                  </Link>
                ))}
              <span>{entry.topic}</span>
              <span>{entry.place}</span>
              <span>
                {latest
                  ? `Answered ${day(latest)}`
                  : `Asked ${day(entry.date)}`}
              </span>
            </p>
          </div>
          <Link
            className="button button-outline q-answer"
            href={`/entries/${entry.id}?discuss=1`}
          >
            <MessageCircleQuestion size={15} aria-hidden="true" />
            {responses ? "Join in" : "Answer"}
          </Link>
        </li>
      ))}
    </ol>
  );
}

const shelves: {
  key: string;
  label: string;
  match: (e: EntrySummary) => boolean;
}[] = [
  { key: "worked", label: "What worked", match: (e) => e.outcome === "worked" },
  {
    key: "failed",
    label: "What didn’t work",
    match: (e) => e.outcome === "failed",
  },
  { key: "mixed", label: "Mixed results", match: (e) => e.outcome === "mixed" },
  {
    key: "ongoing",
    label: "Still being tested",
    match: (e) =>
      e.outcome === "ongoing" || (!e.outcome && e.kind !== "problem"),
  },
];
/** A community's library, shelved by outcome so people find the answer type they need. */
export function Library({ entries }: { entries: EntrySummary[] }) {
  const filled = shelves
    .map((shelf) => ({ ...shelf, items: entries.filter(shelf.match) }))
    .filter((shelf) => shelf.items.length);
  return (
    <div className="library">
      <nav className="library-index" aria-label="Shelves">
        {filled.map((shelf) => (
          <a key={shelf.key} href={`#shelf-${shelf.key}`}>
            <OutcomeGlyph outcome={shelf.key as "worked"} size={13} />
            {shelf.label}
            <span>{shelf.items.length}</span>
          </a>
        ))}
      </nav>
      <div className="library-shelves">
        {filled.map((shelf) => (
          <section
            key={shelf.key}
            id={`shelf-${shelf.key}`}
            className="shelf"
            aria-labelledby={`shelf-${shelf.key}-title`}
          >
            <h3 id={`shelf-${shelf.key}-title`}>
              {shelf.label} <span>{shelf.items.length}</span>
            </h3>
            <ul>
              {shelf.items.map((e) => (
                <li key={e.id} className="shelf-row">
                  {(e.clip?.poster ?? e.cover) && (
                    <img
                      src={(e.clip?.poster ?? e.cover)!.small}
                      alt=""
                      width={96}
                      height={72}
                      loading="lazy"
                    />
                  )}
                  <div>
                    <Link href={`/entries/${e.id}`} className="shelf-title">
                      {e.title}
                    </Link>
                    <p>{e.excerpt}</p>
                    <span className="shelf-meta">
                      {e.outcome ? outcomeLabels[e.outcome] : "Ongoing"} ·{" "}
                      {e.topic} · {e.place}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/** Ask straight away: the title goes to the composer, already set up as a question. */
export function AskBar({
  community,
  placeholder = "What are you stuck on?",
}: {
  community?: string;
  placeholder?: string;
}) {
  return (
    <form className="ask-bar" action="/new">
      <input type="hidden" name="kind" value="problem" />
      {community && <input type="hidden" name="community" value={community} />}
      <MessageCircleQuestion size={19} aria-hidden="true" />
      <input
        name="q"
        aria-label="Your question"
        placeholder={placeholder}
        maxLength={160}
        autoComplete="off"
      />
      <button className="button button-dark">Ask</button>
    </form>
  );
}
