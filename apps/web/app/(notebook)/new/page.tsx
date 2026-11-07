import type { Metadata } from "next";
import { Composer } from "@/components/composer";
import { currentAccount } from "@/lib/auth.server";
import { joinedSlugs, listCommunities } from "@/lib/communities.server";
import { hasDatabase } from "@/lib/db.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leave a field note" };
export default async function New({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string) =>
    typeof params[key] === "string" ? (params[key] as string) : undefined;
  const account = hasDatabase() ? await currentAccount() : undefined;
  const [communities, joined] = await Promise.all([
    listCommunities(),
    joinedSlugs(account),
  ]);
  return (
    <Composer
      initialKind={one("kind")}
      initialTitle={one("q")?.trim() || undefined}
      relates={one("relates")}
      communities={communities}
      joined={joined}
      initialCommunity={one("community")}
    />
  );
}
