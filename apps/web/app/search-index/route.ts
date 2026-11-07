import { getNotebook } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Titles for the command palette, fetched only when someone opens it. */
export async function GET() {
  const notebook = await getNotebook();
  return Response.json(
    {
      entries: notebook.entries.map(({ id, title, topic, outcome }) => ({
        id,
        title,
        topic,
        outcome,
      })),
    },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
