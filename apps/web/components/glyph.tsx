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
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 19.5c6 0 12.5-2 12.5-8.5 0-4.2-6.2-4.2-6.2 0 0 5.6 7 4.2 13.7-8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
