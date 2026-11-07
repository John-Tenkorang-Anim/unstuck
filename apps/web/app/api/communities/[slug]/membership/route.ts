import { assertSameOrigin, failure, requireAccount } from "@/lib/auth.server";
import { setMembership } from "@/lib/communities.server";
import { rateLimit } from "@/lib/store.server";

export const dynamic = "force-dynamic";
/**
 * Join with {"join": true, "agree": true, "intro": "..."} after reading the
 * rules, or leave with {"join": false}.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    assertSameOrigin(request);
    const account = await requireAccount();
    await rateLimit("join", account.id);
    const input = (await request.json()) as {
      join?: unknown;
      agree?: unknown;
      intro?: unknown;
    };
    return Response.json(
      await setMembership(
        account,
        (await params).slug,
        input.join !== false,
        input,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
