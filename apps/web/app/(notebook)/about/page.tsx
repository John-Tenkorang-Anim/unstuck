import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowUpRight,
  Fingerprint,
  FlaskConical,
  Globe2,
  HeartHandshake,
  Sprout,
} from "lucide-react";
import { LearningLoop } from "@/components/artwork";
export const metadata: Metadata = { title: "A little more about Unstuck" };
export default function About() {
  return (
    <div className="page-container about-container">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">✳ A LITTLE MORE ABOUT US</div>
          <h1>
            Knowledge grows
            <br />
            <em>when we share it.</em>
          </h1>
          <p>
            Unstuck is an open notebook of human experience. A place for the
            things that worked, the things that didn’t, and the questions that
            keep us curious.
          </p>
          <Link href="/new" className="hero-link">
            Your experience belongs here <ArrowUpRight size={15} />
          </Link>
        </div>
        <LearningLoop />
      </section>
      <section className="about-manifesto">
        <span className="section-kicker">A SIMPLE BELIEF</span>
        <h2>
          Somewhere, someone has tried
          <br />
          the thing you’re trying to figure out.
        </h2>
        <p>
          A farmer finding a way to store a harvest. A maker repairing something
          worth keeping. A researcher sharing a result that didn’t fit the
          hypothesis. A small detail from their experience might change yours.
        </p>
        <p>
          We’re making those connections easier to find—and making the evidence
          behind them easier to understand.
        </p>
      </section>
      <section id="principles" className="about-principles">
        <div className="section-heading">
          <div>
            <span className="section-kicker">THE THINGS WE BUILD AROUND</span>
            <h2>A few things we believe.</h2>
          </div>
        </div>
        <div className="principles-grid">
          {[
            {
              icon: FlaskConical,
              title: "Evidence over applause.",
              text: "Votes can help us find an idea. Careful observation, testing, and independent evidence help us understand it.",
            },
            {
              icon: Sprout,
              title: "Context changes everything.",
              text: "A result in one climate, budget, or version may look different in another. The conditions belong in the story.",
            },
            {
              icon: Fingerprint,
              title: "Privacy is the starting point.",
              text: "A different alias on each entry keeps the attention on what was learned. Follow a question or a topic, not a person.",
            },
            {
              icon: HeartHandshake,
              title: "Every attempt counts.",
              text: "A wrong turn is useful knowledge. An unfinished idea is an invitation. You don’t need a perfect result to contribute.",
            },
          ].map((item) => (
            <article key={item.title}>
              <item.icon size={26} />
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>
      <div className="about-preview-note">
        <Globe2 size={24} />
        <div>
          <h3>You’re exploring an early chapter.</h3>
          <p>
            The sample stories are fictional. Saved entries and drafts live on
            your device. When community accounts open, people will be able to
            contribute, test, and grow this notebook together.
          </p>
        </div>
      </div>
      <section className="contribute-banner">
        <div>
          <span className="section-kicker">A LITTLE WISER, TOGETHER.</span>
          <h2>What have you learned lately?</h2>
          <p>It could be the beginning of someone else’s breakthrough.</p>
        </div>
        <Link href="/new" className="button button-dark">
          Leave a field note <ArrowUpRight size={16} />
        </Link>
      </section>
    </div>
  );
}
