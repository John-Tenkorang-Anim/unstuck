import { assertSameOrigin, failure, requireAccount } from "@/lib/auth.server";
import { decideAppeal, StoreError } from "@/lib/store.server";

export const dynamic = "force-dynamic";
/** A moderator upholds or overturns an appeal, with a written explanation. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const account = await requireAccount();
    const { decision, note } = (await request.json()) as {
      decision: string;
      note: string;
    };
    if (decision !== "uphold" && decision !== "overturn")
      throw new StoreError("Choose uphold or overturn.");
    await decideAppeal(
      account,
      (await params).id,
      decision,
      String(note ?? ""),
    );
    return Response.json({ decided: true });
  } catch (error) {
    return failure(error);
  }
}
