import { assertSameOrigin, failure, requireAccount } from "@/lib/auth.server";
import { rotateRecovery } from "@/lib/store.server";

export const dynamic = "force-dynamic";
/** Issue a new recovery code for the signed-in account; the old one stops working. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const account = await requireAccount();
    return Response.json({ recovery: await rotateRecovery(account.id) });
  } catch (error) {
    return failure(error);
  }
}
