import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoMark, OutcomeGlyph } from "@/components/glyph";
import { landingPicture, samplePictures } from "@/lib/data";
import { Sankofa } from "@/components/sankofa";

export const metadata: Metadata = {
  title: { absolute: "Unstuck — Learn from what failed" },
  description:
    "Post the attempt that didn’t work, mark the moment it broke, and find out why with people who’ve been there.",
};

const crowd = [
  "Welders",
  "Farmers",
  "Nurses",
  "Software engineers",
  "Students",
  "Teachers",
  "Researchers",
  "Electricians",
  "Bakers",
  "Mechanics",
  "Lab technicians",
  "Small business owners",
  "Civil engineers",
  "Makers",
];
const outcomes = ["failed", "mixed", "worked", "ongoing"] as const;

/** The front door: what Unstuck is, and one way in. */
export default function Landing() {
  return (
    <div className="lp">
      <header className="lp-nav">
        <Link href="/" className="lp-brand" aria-label="Unstuck">
          <LogoMark size={24} />
          Unstuck
        </Link>
        <nav aria-label="Account">
          <Link href="/account" className="lp-signin">
            Sign in
          </Link>
          <Link href="/discover" className="lp-cta lp-cta-small">
            Get started
          </Link>
        </nav>
      </header>

      <main>
        <section className="lp-hero" aria-labelledby="lp-title">
          <p className="lp-kicker">
            <Sankofa size={20} /> Sankofa: go back and get it
          </p>
          <h1 id="lp-title" className="lp-wordmark">
            Unstuck
          </h1>
          <p className="lp-tagline">
            Learn from what didn’t work.{" "}
            <span className="lp-fail">Build what works next.</span>
          </p>
          <p className="lp-lede">
            Unstuck is where people post the attempts that didn’t work, mark the
            exact moment they broke, and work out why together. So the next
            person doesn’t start from zero.
          </p>
          <div className="lp-actions">
            <Link href="/discover" className="lp-cta">
              Get started <ArrowRight size={18} />
            </Link>
            <Link href="/account" className="lp-ghost">
              Sign in
            </Link>
          </div>
          <img
            className="lp-photo"
            src={landingPicture.src}
            srcSet={`${landingPicture.small} 960w, ${landingPicture.src} 1920w`}
            sizes="100vw"
            width={landingPicture.width}
            height={landingPicture.height}
            alt={landingPicture.alt}
            fetchPriority="high"
          />
          <p className="lp-photo-credit">
            Photo:{" "}
            <a href={landingPicture.credit.source}>
              {landingPicture.credit.author}
            </a>
            , {landingPicture.credit.license}
          </p>
        </section>

        <section className="lp-sankofa" aria-labelledby="lp-sankofa-title">
          <Sankofa size={96} />
          <h2 id="lp-sankofa-title" className="lp-reveal">
            Go back for what you missed.
          </h2>
          <p className="lp-proverb lp-reveal" lang="ak">
            “Se wo were fi na wosankofa a yenkyi.”
          </p>
          <p className="lp-reveal">
            It is not wrong to go back for what you forgot. Sankofa is an Akan
            symbol from Ghana about learning from what came before. Most of what
            we share is what worked. Unstuck keeps the attempts that didn’t, so
            the next person can go back and get them.
          </p>
        </section>

        <section className="lp-steps" aria-labelledby="lp-how">
          <h2 id="lp-how" className="lp-reveal">
            How it works
          </h2>
          <ol>
            <li className="lp-step lp-reveal">
              <div className="lp-visual lp-visual-photo">
                <img
                  src={samplePictures.solar.small}
                  alt=""
                  width={640}
                  height={427}
                  loading="lazy"
                />
                <span className="lp-pin" style={{ left: "52%", top: "40%" }}>
                  1
                </span>
                <span className="lp-tag" style={{ left: "8%", top: "64%" }}>
                  Coating turned cloudy here
                </span>
              </div>
              <span className="lp-num">01</span>
              <h3>Share what happened</h3>
              <p>
                What you tried, what you expected and what went wrong. Pin the
                spot on a photo, PDF or video.
              </p>
            </li>
            <li className="lp-step lp-reveal">
              <div className="lp-visual lp-visual-photo">
                <img
                  src={samplePictures.lab.small}
                  alt=""
                  width={640}
                  height={427}
                  loading="lazy"
                />
                <span className="lp-tag" style={{ left: "8%", top: "70%" }}>
                  Verified · oxygen fell below 5% by day 6
                </span>
              </div>
              <span className="lp-num">02</span>
              <h3>Show the evidence</h3>
              <p>
                Photos, data, test results or a plain personal account. Each is
                labelled for what it is.
              </p>
            </li>
            <li className="lp-step lp-reveal">
              <div className="lp-visual lp-visual-notes">
                <p data-kind="issue">
                  <b>Why it happened</b> At 10 L, oxygen ran short in the middle
                  of the vessel.
                </p>
                <p data-kind="suggestion">
                  <b>Improvement</b> Finer spargers, faster stirring, half the
                  substrate.
                </p>
                <p data-kind="strength">
                  <b>Validated</b> Degradation rose from about 20% to 85%.
                </p>
              </div>
              <span className="lp-num">03</span>
              <h3>Build what works next</h3>
              <p>
                People explain why, propose improvements, test them, and the
                results stay connected to the original attempt.
              </p>
            </li>
          </ol>
        </section>

        <section className="lp-crowd" aria-labelledby="lp-who">
          <h2 id="lp-who" className="lp-reveal">
            For anyone who makes, fixes,
            <br />
            grows, builds or studies.
          </h2>
          {[crowd, [...crowd].reverse()].map((row, r) => (
            <div
              key={r}
              className={`lp-marquee ${r ? "is-reverse" : ""}`}
              aria-hidden={r ? "true" : undefined}
            >
              <div className="lp-marquee-track">
                {[...row, ...row].map((name, i) => (
                  <span key={i}>
                    <OutcomeGlyph
                      outcome={outcomes[i % outcomes.length]}
                      size={16}
                    />
                    {name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="lp-trust" aria-labelledby="lp-trust-title">
          <h2 id="lp-trust-title" className="lp-reveal">
            Built to be trusted.
          </h2>
          <div className="lp-trust-grid">
            <div className="lp-reveal">
              <h3>Evidence over applause</h3>
              <p>
                Explanations rise on observations and replications, not on
                votes.
              </p>
            </div>
            <div className="lp-reveal">
              <h3>Context travels with every result</h3>
              <p>
                Where, when and with what, so you can judge whether it would
                work for you.
              </p>
            </div>
            <div className="lp-reveal">
              <h3>Safe by design</h3>
              <p>
                Uploads are checked, reports reach real moderators, and every
                decision can be appealed.
              </p>
            </div>
          </div>
        </section>

        <section className="lp-final" aria-labelledby="lp-final-title">
          <h2 id="lp-final-title" className="lp-reveal">
            Get unstuck.
          </h2>
          <p className="lp-reveal">
            Somebody has already tried what you’re about to try. See how it
            went.
          </p>
          <div className="lp-actions lp-reveal">
            <Link href="/discover" className="lp-cta">
              Get started <ArrowRight size={18} />
            </Link>
            <Link href="/account" className="lp-ghost">
              Sign in
            </Link>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <span className="lp-brand">
          <LogoMark size={18} /> Unstuck
        </span>
        <nav aria-label="Footer">
          <Link href="/about">About</Link>
          <Link href="/about#principles">Principles</Link>
          <Link href="/about#credits">Photo credits</Link>
        </nav>
      </footer>
    </div>
  );
}
