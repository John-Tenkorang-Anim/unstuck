import { assertSameOrigin, failure, requireAccount } from "@/lib/auth.server";
import { addComment } from "@/lib/discussion.server";
import { rateLimit } from "@/lib/store.server";

export const dynamic = "force-dynamic";
/** Post a comment, question, tried-it report, piece of evidence or reply. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const account = await requireAccount();
    await rateLimit("note", account.id);
    const id = await addComment(
      account,
      (await params).id,
      await request.json(),
    );
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
