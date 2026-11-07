import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { Credit } from "@/components/picture";
import { examples, samplePictures } from "@/lib/data";
export const metadata: Metadata = { title: "A little more about Unstuck" };
const loop = [
  [
    "Someone hits a problem",
    "An experience, a failure or a question becomes an entry, in plain words.",
  ],
  [
    "Others contribute",
    "Answers, attempts and explanations collect around it.",
  ],
  [
    "People test it",
    "Tried-it reports add context: where, when, with what, and what happened.",
  ],
  [
    "Knowledge forms",
    "Claims gather evidence and citations, so you can see why they’re believed.",
  ],
  [
    "Others get unstuck",
    "New questions come out of it, and the loop starts again.",
  ],
];
const principles = [
  [
    "Evidence over applause.",
    "Votes can help us find an idea. Careful observation, testing, and independent evidence help us understand it.",
  ],
  [
    "Context changes everything.",
    "A result in one climate, budget, or version may look different in another. The conditions belong in the story.",
  ],
  [
    "Privacy is the starting point.",
    "A different alias on each entry keeps the attention on what was learned. Follow a question or a topic, not a person.",
  ],
  [
    "Every attempt counts.",
    "A wrong turn is useful knowledge. An unfinished idea is an invitation. You don’t need a perfect result to contribute.",
  ],
];
export default function About() {
  return (
    <>
      <section className="about-hero frame">
        <p className="label">About Unstuck</p>
        <h1>
          Somewhere, someone has tried the thing you’re{" "}
          <span className="tint-brand">trying to figure out.</span>
        </h1>
        <div className="about-columns">
          <p>
            A farmer finding a way to store a harvest. A maker repairing
            something worth keeping. A researcher sharing a result that didn’t
            fit the hypothesis. A small detail from their experience might
            change yours.
          </p>
          <p>
            Unstuck is an open record of those attempts. It keeps{" "}
            <strong>what worked</strong>, <strong>what didn’t</strong>, and the{" "}
            <strong>questions still open</strong>, and it makes the evidence
            behind them easy to read.
          </p>
        </div>
      </section>
      <section className="frame about-section" aria-labelledby="loop-title">
        <h2 id="loop-title">How knowledge moves</h2>
        <ol className="loop">
          {loop.map(([title, text], index) => (
            <li key={title}>
              <span className="loop-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <strong>{title}</strong>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>
      <section
        id="principles"
        className="frame about-section"
        aria-labelledby="principles-title"
      >
        <h2 id="principles-title">What we build around</h2>
        <div className="principles">
          {principles.map(([title, text], index) => (
            <article key={title}>
              <span className="loop-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <div className="frame">
        <div className="sample-banner about-note">
          <span className="example-tag">Early access</span>
          <p>
            The sample stories are fictional. Saved entries and drafts live on
            your device. When community accounts open, people will be able to
            contribute, test, and grow it together.
          </p>
        </div>
      </div>
      <section
        id="credits"
        className="frame about-section"
        aria-labelledby="credits-title"
      >
        <h2 id="credits-title">Photo and film credits</h2>
        <ul className="credits">
          {Object.values(samplePictures).map((picture) => (
            <li key={picture.src}>
              <span>{picture.alt}</span>
              <Credit credit={picture.credit} />
            </li>
          ))}
          {examples
            .filter((entry) => entry.clip)
            .map((entry) => (
              <li key={entry.clip!.src}>
                <span>Film: {entry.clip!.title}</span>
                {entry.clip!.credit && <Credit credit={entry.clip!.credit} />}
              </li>
            ))}
        </ul>
      </section>
      <section className="contribute-banner">
        <div className="frame contribute-inner">
          <h2>
            What have you <span className="tint-star">learned lately?</span>
          </h2>
          <div>
            <p>It could be the beginning of someone else’s breakthrough.</p>
            <Link href="/new" className="button button-invert">
              Leave a field note <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
