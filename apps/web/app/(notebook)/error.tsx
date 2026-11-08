"use client";
import Link from "next/link";

export default function NotebookError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <section
      className="frame unavailable-page"
      aria-labelledby="unavailable-title"
    >
      <p className="record-kicker">Unable to load this view</p>
      <h1 id="unavailable-title">Please try again in a moment.</h1>
      <p>
        We couldn’t retrieve the shared notebook. You can retry this view or
        return to your space.
      </p>
      <div className="record-actions-row">
        <button className="button button-dark" onClick={() => retry()}>
          Try again
        </button>
        <Link className="text-link" href="/notebook">
          Go to My Space
        </Link>
      </div>
    </section>
  );
}
