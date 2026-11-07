import { assertSameOrigin, failure, requireAccount } from "@/lib/auth.server";
import { resolveNote } from "@/lib/store.server";

export const dynamic = "force-dynamic";
/** The session owner or the note's author can mark a note resolved. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const account = await requireAccount();
    await resolveNote((await params).id, account.id);
    return Response.json({ resolved: true });
  } catch (error) {
    return failure(error);
  }
}
