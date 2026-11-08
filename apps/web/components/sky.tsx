import Link from "next/link";
import type { QuestionItem } from "@/lib/questions.server";

/** A small seeded generator, so the star field is the same on every render. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const W = 1200;
const H = 460;
const random = seeded(17);
const field = Array.from({ length: 90 }, () => ({
  x: random() * W,
  y: random() * H,
  r: 0.5 + random() * 1.1,
  o: 0.18 + random() * 0.4,
}));
// Two constellations, either side of the headline, so text stays clear.
// Alternate sides so even a few questions balance around the headline, and
// keep both constellations clear of the text in the middle.
const anchors = [
  { x: 96, y: 150, side: "left" },
  { x: 1104, y: 96, side: "right" },
  { x: 200, y: 78, side: "left" },
  { x: 1140, y: 236, side: "right" },
  { x: 246, y: 230, side: "left" },
  { x: 1012, y: 330, side: "right" },
  { x: 130, y: 330, side: "left" },
] as const;
const lines: [number, number][] = [
  [0, 2],
  [2, 4],
  [4, 6],
  [6, 0],
  [1, 3],
  [3, 5],
];

/**
 * The home page as a star chart. Faint coordinate lines and a seeded star
 * field set the scene; the bright stars are real questions people asked, so
 * the decoration is also a way in. Unanswered ones glow pink.
 */
export function Sky({ questions }: { questions: QuestionItem[] }) {
  const stars = anchors
    .slice(0, questions.length)
    .map((anchor, i) => ({ ...anchor, item: questions[i] }));
  return (
    <div className="sky" aria-hidden={stars.length ? undefined : true}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        className="sky-chart"
        aria-hidden="true"
      >
        <g className="sky-grid">
          <ellipse cx={W / 2} cy={H + 260} rx={760} ry={520} />
          <ellipse cx={W / 2} cy={H + 260} rx={620} ry={420} />
          <ellipse cx={W / 2} cy={H + 260} rx={480} ry={320} />
          <line x1={W / 2} y1={0} x2={W / 2} y2={H} />
          <line x1={W / 2 - 420} y1={0} x2={W / 2 - 300} y2={H} />
          <line x1={W / 2 + 420} y1={0} x2={W / 2 + 300} y2={H} />
        </g>
        <g className="sky-field">
          {field.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={s.o} />
          ))}
        </g>
        <g className="sky-lines">
          {lines
            .filter(([a, b]) => stars[a] && stars[b])
            .map(([a, b]) => (
              <line
                key={`${a}-${b}`}
                x1={stars[a].x}
                y1={stars[a].y}
                x2={stars[b].x}
                y2={stars[b].y}
              />
            ))}
        </g>
      </svg>
      {stars.length > 0 && (
        <nav className="sky-stars" aria-label="Questions people asked">
          {stars.map(({ x, y, side, item }) => (
            <Link
              key={item.entry.id}
              href={`/entries/${item.entry.id}`}
              className="sky-star"
              data-side={side}
              data-waiting={item.responses ? undefined : true}
              style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%` }}
            >
              <span className="sky-dot" aria-hidden="true" />
              <span className="sky-label">
                <span className="sr-only">
                  {item.responses
                    ? "Answered question: "
                    : "Waiting for an answer: "}
                </span>
                {item.entry.title}
              </span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
