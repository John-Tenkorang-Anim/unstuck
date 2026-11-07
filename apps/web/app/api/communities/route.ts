import { assertSameOrigin, failure, requireAccount } from "@/lib/auth.server";
import { createCommunity } from "@/lib/communities.server";
import { rateLimit } from "@/lib/store.server";

export const dynamic = "force-dynamic";
/** Start an open community. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const account = await requireAccount();
    await rateLimit("community", account.id);
    const slug = await createCommunity(account, await request.json());
    return Response.json({ slug }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
