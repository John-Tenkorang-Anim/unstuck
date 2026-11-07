import type { Metadata } from "next";
import { Composer } from "@/components/composer";
export const metadata: Metadata = { title: "Leave a field note" };
export default async function New({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <Composer
      initialKind={typeof params.kind === "string" ? params.kind : undefined}
      relates={typeof params.relates === "string" ? params.relates : undefined}
    />
  );
}
