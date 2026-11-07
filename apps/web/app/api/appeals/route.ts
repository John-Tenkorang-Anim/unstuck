import {
  assertSameOrigin,
  currentAccount,
  failure,
  requireDatabase,
} from "@/lib/auth.server";
import {
  fileAppeal,
  rateLimit,
  StoreError,
  type AppealTarget,
} from "@/lib/store.server";

export const dynamic = "force-dynamic";
const types: AppealTarget[] = ["session", "note", "entry", "account"];

/** Appeal a hidden item or a suspension. Suspended accounts can still appeal. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    requireDatabase();
    const account = await currentAccount();
    if (!account) throw new StoreError("Sign in to appeal.", 401);
    await rateLimit("report", account.id);
    const input = (await request.json()) as Record<string, string>;
    if (!types.includes(input.type as AppealTarget))
      throw new StoreError("Unknown item.");
    await fileAppeal(
      account,
      input.type as AppealTarget,
      String(input.id ?? ""),
      String(input.statement ?? ""),
    );
    return Response.json({ filed: true }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
