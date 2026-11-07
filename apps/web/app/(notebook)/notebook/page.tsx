export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, NotebookPen } from "lucide-react";
import { Discovery } from "@/components/discovery";
import { getNotebook } from "@/lib/api";
export const metadata: Metadata = { title: "Your notebook" };
export default async function Notebook() {
  return (
    <>
      <Discovery notebook={await getNotebook()} savedOnly />
      <div className="notebook-drafts-link">
        <NotebookPen size={20} />
        <div>
          <strong>A thought still taking shape?</strong>
          <p>Your unfinished field note is waiting in the composer.</p>
        </div>
        <Link className="button button-outline" href="/new">
          Open your draft <ArrowUpRight size={15} />
        </Link>
      </div>
    </>
  );
}
