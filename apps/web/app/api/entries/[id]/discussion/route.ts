import { currentAccount, failure } from "@/lib/auth.server";
import { listComments, type Sort, type View } from "@/lib/discussion.server";

export const dynamic = "force-dynamic";
const sorts: Sort[] = ["helpful", "newest", "oldest"];

/** One page of responses for a field note. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const url = new URL(request.url);
    const view = url.searchParams.get("view") ?? "all";
    const sort = url.searchParams.get("sort") as Sort;
    const viewer = await currentAccount();
    const page = await listComments((await params).id, {
      view: (["all", "questions", "tried"].includes(view) ||
      view.startsWith("explanation:")
        ? view
        : "all") as View,
      sort: sorts.includes(sort) ? sort : "helpful",
      q: url.searchParams.get("q") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      viewer: viewer?.id,
    });
    return Response.json(page, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
