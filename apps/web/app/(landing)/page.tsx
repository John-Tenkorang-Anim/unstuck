import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoMark, OutcomeGlyph } from "@/components/glyph";
import { samplePictures } from "@/lib/data";

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
          <div className="lp-space" aria-hidden="true">
            <div className="lp-stars" />
            <div className="lp-stars lp-stars-far" />
            <div className="lp-cherenkov" />
          </div>
          <p className="lp-kicker">
            <span className="lp-dot" aria-hidden="true" /> The open record of
            what didn’t work
          </p>
          <div className="lp-mark-wrap">
            <svg
              className="lp-orbit"
              viewBox="0 0 1000 300"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <ellipse
                className="lp-orbit-ring"
                cx="500"
                cy="150"
                rx="490"
                ry="118"
              />
              <ellipse
                className="lp-orbit-comet"
                cx="500"
                cy="150"
                rx="490"
                ry="118"
                pathLength={1}
              />
            </svg>
            <h1 id="lp-title" className="lp-wordmark">
              Unstuck
            </h1>
          </div>
          <p className="lp-tagline">
            Learn from <span className="lp-fail">what failed.</span>
          </p>
          <svg
            className="lp-line"
            viewBox="0 0 1200 140"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <path
              pathLength={1}
              d="M0 96 C60 96 92 74 120 52 C150 28 196 30 200 62 C204 96 152 112 140 82 C126 46 196 18 238 40 C282 62 262 112 226 104 C190 96 214 44 262 44 C318 44 330 92 300 98 C272 104 280 60 330 56 C390 52 420 70 470 70 L1200 70"
            />
          </svg>
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
        </section>

        <section className="lp-statement" aria-label="Why Unstuck exists">
          <p className="lp-reveal">
            Most of what we share is what <em className="lp-worked">worked</em>.
            <br />
            <span className="lp-muted">
              Behind every result is a pile of attempts nobody wrote down.
              That’s where the useful part is.
            </span>
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
                  src={samplePictures.print.small}
                  alt=""
                  width={640}
                  height={853}
                  loading="lazy"
                />
                <span className="lp-pin" style={{ left: "52%", top: "50%" }}>
                  1
                </span>
                <span className="lp-pin" style={{ left: "45%", top: "22%" }}>
                  2
                </span>
                <span className="lp-tag" style={{ left: "8%", top: "60%" }}>
                  Layers stop stacking here
                </span>
              </div>
              <span className="lp-num">01</span>
              <h3>Show what happened</h3>
              <p>
                A photo, a short video, a PDF, your working. Paste it in and pin
                the spot that went wrong.
              </p>
            </li>
            <li className="lp-step lp-reveal">
              <div className="lp-visual lp-visual-film">
                <img
                  src={samplePictures.tacoma.small}
                  alt=""
                  width={640}
                  height={480}
                  loading="lazy"
                />
                <div className="lp-timeline">
                  <span className="lp-progress" />
                  <i style={{ left: "41%" }} />
                  <i style={{ left: "78%" }} className="is-break" />
                </div>
                <span className="lp-moment">
                  <b>1:56</b> The centre span tears loose
                </span>
              </div>
              <span className="lp-num">02</span>
              <h3>Mark the moment it broke</h3>
              <p>
                Flag the second in the footage where it went wrong, so people
                can jump straight to it.
              </p>
            </li>
            <li className="lp-step lp-reveal">
              <div className="lp-visual lp-visual-notes">
                <p data-kind="issue">
                  <b>Issue</b> The part came loose from the bed, so every layer
                  after this printed into the air.
                </p>
                <p data-kind="suggestion">
                  <b>Suggestion</b> Add a 5 mm brim and clean the bed before
                  printing.
                </p>
                <p data-kind="strength">
                  <b>Working well</b> Your first layers are even. Bed levelling
                  isn’t the problem.
                </p>
              </div>
              <span className="lp-num">03</span>
              <h3>Find out why</h3>
              <p>
                People who’ve been there point at the exact spot, step or line,
                and say what to try next.
              </p>
            </li>
          </ol>
        </section>

        <section className="lp-crowd" aria-labelledby="lp-who">
          <div className="lp-space" aria-hidden="true">
            <div className="lp-stars" />
            <div className="lp-stars lp-stars-far" />
            <div className="lp-cherenkov" />
          </div>
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
          <div className="lp-space" aria-hidden="true">
            <div className="lp-stars" />
            <div className="lp-stars lp-stars-far" />
            <div className="lp-cherenkov" />
          </div>
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
