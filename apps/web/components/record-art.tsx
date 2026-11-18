import type { OutcomeKind } from "@/lib/outcome";

/** A small, stable random generator, so the same record always gets the same art. */
function seeded(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
/** How far each outcome travels from what didn’t work to what works. */
const reach: Record<OutcomeKind, number> = {
  failed: 0.5,
  partial: 0.68,
  progress: 0.78,
  open: 0.55,
  worked: 1,
};
const palette = ["var(--ember)", "var(--harvest)", "var(--brand)"];

/**
 * Generated art for a record, instead of a stock photo: tiles like the logo,
 * rising from clay red through harvest gold towards leaf green. How far they
 * get depends on how it turned out, and the layout comes from the record’s id.
 */
export function RecordArt({
  seed,
  outcome,
  label,
  className,
  wide = false,
}: {
  /** A banner keeps the bottom of the art in view, where every journey starts. */
  wide?: boolean;
  seed: string;
  outcome: OutcomeKind;
  label?: string;
  className?: string;
}) {
  const rand = seeded(seed);
  const end = reach[outcome];
  const tiles: {
    x: number;
    y: number;
    s: number;
    r: number;
    c: string;
    o: number;
  }[] = [];
  const paths = 2 + Math.floor(rand() * 2);
  for (let p = 0; p < paths; p++) {
    const startX = 20 + rand() * 60;
    const startY = 185 + rand() * 20;
    const drift = 0.75 + rand() * 0.6;
    const steps = 9 + Math.floor(rand() * 5);
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      if (t > end + 0.02) break;
      // Colour follows the journey: red, then gold, then green.
      const phase = t / Math.max(end, 0.01);
      const c = palette[Math.min(2, Math.floor(t * 3 * (end >= 1 ? 1 : 1.05)))];
      tiles.push({
        x: startX + t * 230 * drift + (rand() - 0.5) * 14,
        y: startY - t * 165 + (rand() - 0.5) * 12,
        s: 13 + t * 15 + rand() * 6,
        r: -18 + t * 34 + (rand() - 0.5) * 16,
        c,
        o: 0.55 + phase * 0.45,
      });
    }
  }
  return (
    <svg
      className={`record-art${className ? ` ${className}` : ""}`}
      viewBox="0 0 300 200"
      preserveAspectRatio={wide ? "xMidYMax slice" : "xMidYMid slice"}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-outcome={outcome}
    >
      <rect width="300" height="200" className="record-art-ground" />
      {tiles.map((t, i) => (
        <rect
          key={i}
          x={t.x - t.s / 2}
          y={t.y - t.s / 2}
          width={t.s}
          height={t.s}
          rx={t.s * 0.26}
          fill={outcome === "open" ? "none" : t.c}
          stroke={outcome === "open" ? t.c : "none"}
          strokeWidth={outcome === "open" ? 2 : 0}
          opacity={t.o}
          transform={`rotate(${t.r} ${t.x} ${t.y})`}
        />
      ))}
    </svg>
  );
}
