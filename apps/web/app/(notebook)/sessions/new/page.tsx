import type { Metadata } from "next";
import { SessionComposer } from "@/components/session-composer";
import { listCommunities } from "@/lib/communities.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Get feedback on your work" };
export default async function NewSession() {
  const categories = await listCommunities();
  return <SessionComposer categories={categories.map((c) => c.name)} />;
}
