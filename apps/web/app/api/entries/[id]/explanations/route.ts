import { assertSameOrigin, failure, requireAccount } from "@/lib/auth.server";
import { addExplanation } from "@/lib/discussion.server";
import { rateLimit } from "@/lib/store.server";

export const dynamic = "force-dynamic";
/** Propose an explanation for why something happened. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const account = await requireAccount();
    await rateLimit("note", account.id);
    const id = await addExplanation(
      account,
      (await params).id,
      await request.json(),
    );
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
