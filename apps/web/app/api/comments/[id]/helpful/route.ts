import { assertSameOrigin, failure, requireAccount } from "@/lib/auth.server";
import { toggleHelpful } from "@/lib/discussion.server";
import { rateLimit } from "@/lib/store.server";

export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const account = await requireAccount();
    await rateLimit("helpful", account.id);
    return Response.json(await toggleHelpful(account, (await params).id));
  } catch (error) {
    return failure(error);
  }
}
