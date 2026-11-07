import {
  assertSameOrigin,
  failure,
  publicAccount,
  recoverAccount,
} from "@/lib/auth.server";

export const dynamic = "force-dynamic";
/** Sign this browser in to an existing account with its recovery code. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { code } = (await request.json()) as { code?: unknown };
    return Response.json({
      account: publicAccount(await recoverAccount(code)),
    });
  } catch (error) {
    return failure(error);
  }
}
