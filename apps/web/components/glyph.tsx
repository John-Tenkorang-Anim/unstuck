import type { Outcome } from "@/lib/types";

export type OutcomeKey = Outcome | "open";

/**
 * The outcome marks. Shape carries the meaning and colour reinforces it, so a
 * result is still legible in greyscale or with a colour vision deficiency.
 */
export function OutcomeGlyph({
  outcome,
  size = 14,
}: {
  outcome: OutcomeKey;
  size?: number;
}) {
  return (
    <svg
      className="glyph"
      data-outcome={outcome}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      {outcome === "worked" && (
        <circle cx="8" cy="8" r="6.5" fill="currentColor" />
      )}
      {outcome === "failed" && (
        <>
          <circle
            cx="8"
            cy="8"
            r="5.75"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="m5.5 5.5 5 5m0-5-5 5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </>
      )}
      {outcome === "mixed" && (
        <>
          <circle
            cx="8"
            cy="8"
            r="5.75"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M8 2.25a5.75 5.75 0 0 0 0 11.5Z" fill="currentColor" />
        </>
      )}
      {outcome === "ongoing" && (
        <>
          <path
            d="M8 2.25A5.75 5.75 0 1 1 2.25 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="8" cy="8" r="2" fill="currentColor" />
        </>
      )}
      {outcome === "open" && (
        <circle
          cx="8"
          cy="8"
          r="5.75"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="2 2.5"
        />
      )}
    </svg>
  );
}

/** The product's mark: a tangled line that comes loose. */
/**
 * The Unstuck mark: three layers stepping up and to the right, each turning a
 * little further and becoming more solid. Uncertainty unfolding into
 * understanding; a failed attempt becoming the next, better one.
 */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      className="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="11"
        width="10"
        height="10"
        rx="2.6"
        fill="currentColor"
        opacity="0.28"
        transform="rotate(-10 7 16)"
      />
      <rect
        x="6.5"
        y="7"
        width="10"
        height="10"
        rx="2.6"
        fill="currentColor"
        opacity="0.55"
        transform="rotate(4 11.5 12)"
      />
      <rect
        x="11.5"
        y="2.5"
        width="10"
        height="10"
        rx="2.6"
        fill="currentColor"
        transform="rotate(16 16.5 7.5)"
      />
    </svg>
  );
}
