import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SessionWorkspace } from "@/components/session-workspace";
import { getNotebook } from "@/lib/api";
import { examples } from "@/lib/data";
import { sessionById } from "@/lib/sessions";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  return {
    title: sessionById((await params).id)?.title ?? "Session not found",
  };
}
export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = sessionById((await params).id);
  const { mode } = await getNotebook();
  if (!session || mode !== "examples") notFound();
  const t = Number((await searchParams).t);
  const entry = session.entryId
    ? examples.find((e) => e.id === session.entryId)
    : undefined;
  return (
    <div className="frame session-page">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/sessions" className="back-link">
          <ArrowLeft size={14} /> Critique
        </Link>
        {entry && (
          <>
            <span aria-hidden="true">/</span>
            <Link href={`/entries/${entry.id}`}>{entry.title}</Link>
          </>
        )}
      </nav>
      <p className="example-notice">
        <span className="example-tag">Sample data</span> A fictional session.
        Notes you add stay on this device.
      </p>
      <SessionWorkspace
        session={session}
        clip={entry?.clip}
        start={Number.isFinite(t) && t >= 0 ? t : undefined}
      />
    </div>
  );
}
