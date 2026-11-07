import { Discovery } from "@/components/discovery";
import { getNotebook } from "@/lib/api";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <Discovery
      notebook={await getNotebook()}
      initialTopic={typeof params.topic === "string" ? params.topic : ""}
      initialQuery={typeof params.q === "string" ? params.q : ""}
      initialOutcome={typeof params.outcome === "string" ? params.outcome : ""}
    />
  );
}
