import { assertSameOrigin, failure, requireAccount } from "@/lib/auth.server";
import { hashListConfigured } from "@/lib/hashlist.server";
import { recheckUploads, StoreError } from "@/lib/store.server";

export const dynamic = "force-dynamic";
/** Check every stored image against the current hash list. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const account = await requireAccount();
    if (!hashListConfigured())
      throw new StoreError(
        "No hash list is configured. Set UNSTUCK_HASH_LIST.",
      );
    return Response.json(await recheckUploads(account));
  } catch (error) {
    return failure(error);
  }
}
