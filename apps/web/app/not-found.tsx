import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoMark } from "@/components/glyph";
export default function NotFound() {
  return (
    <main className="empty-state full-empty frame">
      <span className="not-found-mark">
        <LogoMark size={44} />
      </span>
      <p className="label">404</p>
      <h1>Nothing recorded here.</h1>
      <p>We couldn’t find that entry. There are other paths worth exploring.</p>
      <Link href="/" className="button button-dark">
        <ArrowLeft size={15} /> Back to all entries
      </Link>
    </main>
  );
}
