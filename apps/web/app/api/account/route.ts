import {
  assertSameOrigin,
  createAccount,
  currentAccount,
  failure,
  publicAccount,
  signOut,
} from "@/lib/auth.server";

export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json({ account: publicAccount(await currentAccount()) });
}
/** Create an account. The recovery code is returned once and never again. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { account, recovery } = await createAccount(await request.json());
    return Response.json(
      { account: publicAccount(account), recovery },
      { status: 201 },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    await signOut();
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(error);
  }
}
