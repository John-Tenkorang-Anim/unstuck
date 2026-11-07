import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
export default function NotFound() {
  return (
    <div className="empty-state full-empty">
      <Compass size={44} />
      <div className="eyebrow">A SMALL DETOUR</div>
      <h1>
        This page is still
        <br />a little <em>unstuck.</em>
      </h1>
      <p>
        We couldn’t find that field note. There are other paths worth exploring.
      </p>
      <Link href="/" className="button button-dark">
        <ArrowLeft size={16} /> Back to the notebook
      </Link>
    </div>
  );
}
