import { assertSameOrigin, failure, requireAccount } from "@/lib/auth.server";
import type { SessionStatus } from "@/lib/sessions";
import { setSessionStatus, StoreError } from "@/lib/store.server";

export const dynamic = "force-dynamic";
const statuses: SessionStatus[] = ["open", "in-review", "revised", "resolved"];

/** Only the person who opened a session can move its status. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const account = await requireAccount();
    const { id } = await params;
    const { status } = (await request.json()) as { status: SessionStatus };
    if (!statuses.includes(status)) throw new StoreError("Unknown status.");
    await setSessionStatus(id, account.id, status);
    return Response.json({ status });
  } catch (error) {
    return failure(error);
  }
}
