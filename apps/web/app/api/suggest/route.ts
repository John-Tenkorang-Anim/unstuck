import { getCorpus } from "@/lib/search.server";
import { search } from "@/lib/search";

export const dynamic = "force-dynamic";

/**
 * Suggestions while someone types in the home search: the best few matches,
 * using the same forgiving search as the results page.
 */
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "")
    .trim()
    .slice(0, 120);
  if (q.length < 2) return Response.json({ items: [], corrected: null });
  const { docs } = await getCorpus();
  const { results, corrected } = search(docs, q);
  return Response.json(
    {
      corrected,
      items: results.slice(0, 6).map(({ doc }) => ({
        href: doc.href,
        title: doc.title,
        kind: doc.types.has("questions")
          ? "Open question"
          : doc.source === "session"
            ? "Critique"
            : doc.kindLabel,
        outcome: doc.source === "entry" ? (doc.outcome ?? "open") : null,
        field: doc.field,
      })),
    },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
