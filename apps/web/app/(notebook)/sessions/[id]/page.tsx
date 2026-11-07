import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SessionWorkspace } from "@/components/session-workspace";
import { getNotebook } from "@/lib/api";
import { currentAccount, publicAccount } from "@/lib/auth.server";
import { examples } from "@/lib/data";
import { loadSession } from "@/lib/shared.server";
import { markSessionSeen } from "@/lib/discussion.server";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const loaded = await loadSession((await params).id);
  return { title: loaded?.session.title ?? "Session not found" };
}
export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Owners and moderators can see their own hidden sessions and files under review.
  const account = await currentAccount();
  const loaded = await loadSession((await params).id, account);
  if (!loaded) notFound();
  if (loaded.sample && (await getNotebook()).mode !== "examples") notFound();
  const { session, notes, owner, sample } = loaded;
  if (account && account.id === owner)
    await markSessionSeen(account, session.id);
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
      {loaded.hidden && (
        <p className="review-notice" role="status">
          This session is hidden from everyone else.{" "}
          <Link className="text-link" href="/account#standing">
            See why, or appeal
          </Link>
        </p>
      )}
      {sample && (
        <p className="example-notice">
          <span className="example-tag">Sample data</span> A fictional session.
          Notes you add are shared with everyone.
        </p>
      )}
      <SessionWorkspace
        session={session}
        clip={entry?.clip}
        start={Number.isFinite(t) && t >= 0 ? t : undefined}
        initialNotes={notes}
        viewer={publicAccount(account)}
        isOwner={!!account && account.id === owner}
      />
    </div>
  );
}
