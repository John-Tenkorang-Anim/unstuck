import { assertSameOrigin, failure, requireAccount } from "@/lib/auth.server";
import { createEntry } from "@/lib/entries.server";
import { rateLimit, StoreError } from "@/lib/store.server";

export const dynamic = "force-dynamic";
/** Publish a field note with its photos and video. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const account = await requireAccount();
    await rateLimit("entry", account.id);
    const id = await createEntry(account, await request.formData());
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return failure(
      error instanceof SyntaxError
        ? new StoreError("That note couldn’t be read.")
        : error,
    );
  }
}
