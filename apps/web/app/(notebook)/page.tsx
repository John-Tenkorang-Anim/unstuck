import { Discovery } from "@/components/discovery";
import { getNotebook } from "@/lib/api";
import { sampleSessions } from "@/lib/sessions";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const notebook = await getNotebook();
  return (
    <Discovery
      notebook={notebook}
      sessions={notebook.mode === "examples" ? sampleSessions : []}
      initialTopic={typeof params.topic === "string" ? params.topic : ""}
      initialQuery={typeof params.q === "string" ? params.q : ""}
      initialOutcome={typeof params.outcome === "string" ? params.outcome : ""}
    />
  );
}
