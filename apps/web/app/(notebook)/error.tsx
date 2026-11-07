"use client";
import { RotateCcw } from "lucide-react";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty-state full-empty">
      <h1>
        A small pause
        <br />
        in the story.
      </h1>
      <p>Something went wrong opening the notebook. Give it another try.</p>
      <button className="button button-dark" onClick={reset}>
        <RotateCcw size={16} /> Try again
      </button>
    </div>
  );
}
