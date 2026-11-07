import { timingSafeEqual } from "node:crypto";
import {
  assertSameOrigin,
  failure,
  requester,
  requireAccount,
} from "@/lib/auth.server";
import { makeModerator, rateLimit, StoreError } from "@/lib/store.server";

export const dynamic = "force-dynamic";
/** Become a moderator with the code set in UNSTUCK_MODERATOR_CODE. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const account = await requireAccount();
    await rateLimit("recover", await requester());
    const expected = process.env.UNSTUCK_MODERATOR_CODE ?? "";
    const { code } = (await request.json()) as { code?: string };
    const given = Buffer.from(String(code ?? ""));
    const wanted = Buffer.from(expected);
    if (
      expected.length < 12 ||
      given.length !== wanted.length ||
      !timingSafeEqual(given, wanted)
    )
      throw new StoreError("That moderator code isn’t right.", 403);
    await makeModerator(account.id);
    return Response.json({ moderator: true });
  } catch (error) {
    return failure(error);
  }
}
