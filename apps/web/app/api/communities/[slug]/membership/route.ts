import { assertSameOrigin, failure, requireAccount } from "@/lib/auth.server";
import { setMembership } from "@/lib/communities.server";
import { rateLimit } from "@/lib/store.server";

export const dynamic = "force-dynamic";
/** Join a community with {"join": true}, or leave it with {"join": false}. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    assertSameOrigin(request);
    const account = await requireAccount();
    await rateLimit("join", account.id);
    const input = (await request.json()) as { join?: unknown };
    return Response.json(
      await setMembership(account, (await params).slug, input.join !== false),
    );
  } catch (error) {
    return failure(error);
  }
}
