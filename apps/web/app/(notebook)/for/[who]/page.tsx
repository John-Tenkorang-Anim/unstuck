import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";

type Way = {
  label: string;
  audience: string;
  headline: string;
  lede: string;
  steps: { title: string; body: string; href: string; action: string }[];
  example: { title: string; href: string; text: string };
  promise: string[];
};
const ways: Record<string, Way> = {
  students: {
    label: "Students",
    audience: "student",
    headline: "Stuck on a lab, a proof or a project?",
    lede: "Get hints from people who’ve been there, without being handed the answer.",
    steps: [
      {
        title: "Ask for hints",
        body: "Mark it as graded work and helpers give pointers and questions, not solutions.",
        href: "/help/new?as=student&kind=hints",
        action: "Ask for hints",
      },
      {
        title: "Show your working",
        body: "Share your steps, code or data, and people pin feedback to the exact line that’s off.",
        href: "/sessions/new",
        action: "Share your working",
      },
      {
        title: "Learn from what didn’t work",
        body: "Read how others got stuck on the same thing, and what finally helped.",
        href: "/discover?tab=lessons",
        action: "Browse lessons",
      },
    ],
    example: {
      title: "Where could an 8% error in my pendulum lab come from?",
      href: "/help/help-pendulum",
      text: "A student asked for hints only. A teacher pointed at where the length is measured to, and the student found the error themselves.",
    },
    promise: [
      "Hints-only mode for graded work",
      "No account needed to read",
      "Your name, your choice of how much to share",
    ],
  },
  researchers: {
    label: "Researchers",
    audience: "researcher",
    headline: "Your negative results are someone else’s head start.",
    lede: "Publish what didn’t work with its methods and measurements, find a lab to repeat a result, and compare runs side by side.",
    steps: [
      {
        title: "Publish an attempt in detail",
        body: "Method, measurements, conditions and limitations, with a licence you choose and a citable link.",
        href: "/new?type=attempt",
        action: "Share an attempt",
      },
      {
        title: "Find a test partner",
        body: "Ask for someone with the equipment or setting to repeat or extend your run.",
        href: "/help/new?as=researcher&kind=partner",
        action: "Find a partner",
      },
      {
        title: "Compare attempts",
        body: "See which conditions separate what failed from what worked, with every insight citing its records.",
        href: "/analyze",
        action: "Open Compare",
      },
    ],
    example: {
      title: "Looking for a lab to repeat our 10 L run at 50 L",
      href: "/help/help-scale-partner",
      text: "A lab asked for a partner with a bigger vessel. A pilot plant offered a slot and hourly oxygen logging.",
    },
    promise: [
      "Observations, hypotheses and verified claims kept apart",
      "Citations and version history on every record",
      "Members-only workspaces before you publish",
    ],
  },
  engineers: {
    label: "Engineers and makers",
    audience: "engineer",
    headline: "Someone has already hit this exact failure.",
    lede: "Find the people who did, get a second pair of eyes, and test the fix properly.",
    steps: [
      {
        title: "Ask who’s seen it",
        body: "Your request reaches people who documented something similar, and they see why.",
        href: "/help/new?as=engineer&kind=tried",
        action: "Ask who’s seen it",
      },
      {
        title: "Get a review",
        body: "Share a photo, PDF, code or data and get feedback pinned to the exact spot.",
        href: "/sessions/new",
        action: "Ask for a review",
      },
      {
        title: "Test the fix",
        body: "Turn an idea into a proposal with a test plan, runs and findings.",
        href: "/problems",
        action: "Browse problems",
      },
    ],
    example: {
      title:
        "Has anyone fixed “heap out of memory” during type checking in CI?",
      href: "/help/help-ci-memory",
      text: "Sent to 22 people who follow the category or logged a similar failure.",
    },
    promise: [
      "Conditions recorded so you can judge if it applies",
      "Tests with plans, runs and findings",
      "Credit for whoever helps",
    ],
  },
  communities: {
    label: "Communities",
    audience: "community",
    headline: "Fix it together, and keep track of every promise.",
    lede: "Raise what’s wrong where you live, gather neighbours who are affected, and follow each response until residents can check the result.",
    steps: [
      {
        title: "Start or join a workspace",
        body: "A shared space for your street, school or project, public or private.",
        href: "/workspaces",
        action: "Find a workspace",
      },
      {
        title: "Raise a concern",
        body: "Say what’s happening and what change you’re asking for. Neighbours add their voice.",
        href: "/workspaces/market-road-neighbours?tab=concerns",
        action: "See how it works",
      },
      {
        title: "Ask for help or equipment",
        body: "Space, tools, expertise: ask people nearby who’ve done something similar.",
        href: "/help/new?as=community&kind=equipment",
        action: "Ask for help",
      },
    ],
    example: {
      title: "A dry place to keep sorted plastic between pickups",
      href: "/help/help-storage",
      text: "A street pilot needed storage. A teacher offered the school’s covered bike shelter.",
    },
    promise: [
      "Commitments with dates, and overdue ones shown",
      "Responses must cite their source",
      "Readable by anyone, without an account",
    ],
  },
};
export async function generateMetadata({
  params,
}: {
  params: Promise<{ who: string }>;
}): Promise<Metadata> {
  const way = ways[(await params).who];
  return { title: way ? `Unstuck for ${way.label.toLowerCase()}` : "Unstuck" };
}

/** A short guide for each group: what they can do here, and one real example. */
export default async function ForWho({
  params,
}: {
  params: Promise<{ who: string }>;
}) {
  const way = ways[(await params).who];
  if (!way) notFound();
  return (
    <div className="frame directory for-page">
      <nav className="for-switch" aria-label="Who it’s for">
        {Object.entries(ways).map(([key, w]) => (
          <Link
            key={key}
            href={`/for/${key}`}
            aria-current={w === way ? "page" : undefined}
          >
            {w.label}
          </Link>
        ))}
      </nav>
      <section className="hub-hero for-hero">
        <div>
          <p className="record-kicker">Unstuck for {way.label.toLowerCase()}</p>
          <h1>{way.headline}</h1>
          <p>{way.lede}</p>
        </div>
        <div className="help-ctas">
          <Link
            className="button button-dark"
            href={`/help/new?as=${way.audience}`}
          >
            Ask for help <ArrowRight size={15} />
          </Link>
          <Link
            className="button button-outline"
            href={`/help?as=${way.audience}`}
          >
            See what others asked
          </Link>
        </div>
      </section>
      <ol className="for-steps">
        {way.steps.map((s, i) => (
          <li key={s.title}>
            <span className="path-num" aria-hidden="true">
              {i + 1}
            </span>
            <h2>{s.title}</h2>
            <p>{s.body}</p>
            <Link className="text-link" href={s.href}>
              {s.action} <ArrowRight size={13} />
            </Link>
          </li>
        ))}
      </ol>
      <div className="for-bottom">
        <Link className="for-example" href={way.example.href}>
          <span className="label">A real example · sample data</span>
          <strong>{way.example.title}</strong>
          <p>{way.example.text}</p>
        </Link>
        <ul className="for-promise">
          {way.promise.map((p) => (
            <li key={p}>
              <Check size={16} aria-hidden="true" /> {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
