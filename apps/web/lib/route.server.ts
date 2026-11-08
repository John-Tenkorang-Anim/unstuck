import "server-only";
import { assertSameOrigin, failure, requireAccount } from "./auth.server";
import { rateLimit, type Account, type limits } from "./store.server";

/**
 * The shape every write endpoint shares: same-origin check, a signed-in
 * account, an optional rate limit, a JSON body, and errors people can read.
 */
export async function write(
  request: Request,
  limit: keyof typeof limits | null,
  work: (account: Account, body: Record<string, unknown>) => Promise<unknown>,
  status = 200,
) {
  try {
    assertSameOrigin(request);
    const account = await requireAccount();
    if (limit) await rateLimit(limit, account.id);
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const result = await work(account, body ?? {});
    return Response.json(result ?? { ok: true }, { status });
  } catch (error) {
    return failure(error);
  }
}
