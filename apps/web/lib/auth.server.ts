import "server-only";
import { cookies, headers } from "next/headers";
import { hasDatabase } from "./db.server";
import {
  accountByToken,
  clean,
  dropToken,
  insertAccount,
  rateLimit,
  recover,
  StoreError,
  type Account,
} from "./store.server";

const COOKIE = "unstuck-account";
const year = 60 * 60 * 24 * 365;
async function setCookie(token: string) {
  const secure = (await headers()).get("x-forwarded-proto") === "https";
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: year,
  });
}
/** Who is asking, for rate limits on actions that don't need an account. */
export async function requester() {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "direct"
  );
}

/** The signed-in account for this request, if any. */
export async function currentAccount(): Promise<Account | undefined> {
  if (!hasDatabase()) return undefined;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return undefined;
  return accountByToken(token).catch(() => undefined);
}
export async function requireAccount() {
  requireDatabase();
  const account = await currentAccount();
  if (!account) throw new StoreError("Choose a name to post as first.", 401);
  if (account.suspended)
    throw new StoreError("This account can’t post right now.", 403);
  return account;
}
export function requireDatabase() {
  if (!hasDatabase())
    throw new StoreError("Sharing needs a database. Set DATABASE_URL.", 503);
}
/**
 * A lightweight account: a display name and optional role, bound to this
 * browser by a random token in an HttpOnly cookie. Only hashes are stored.
 * A recovery code, shown once, signs the same account in elsewhere.
 */
export async function createAccount(input: { name?: unknown; role?: unknown }) {
  requireDatabase();
  await rateLimit("account", await requester());
  const name = clean.text(input.name, 2, 40, "Your name");
  const role =
    typeof input.role === "string" ? input.role.trim().slice(0, 60) : "";
  const { account, token, recovery } = await insertAccount(name, role);
  await setCookie(token);
  return {
    account: {
      ...account,
      moderator: false,
      suspended: false,
      created: new Date().toISOString(),
    },
    recovery,
  };
}
export async function recoverAccount(code: unknown) {
  requireDatabase();
  await rateLimit("recover", await requester());
  const { token, account } = await recover(
    clean.text(code, 8, 40, "The recovery code"),
  );
  await setCookie(token);
  return account;
}
export async function signOut() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token && hasDatabase()) await dropToken(token).catch(() => undefined);
  jar.delete(COOKIE);
}
/** Writes must come from this site. Browsers always send Origin on POST. */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host)
    throw new StoreError("This request didn’t come from Unstuck.", 403);
}
export const publicAccount = (account?: Account) =>
  account
    ? {
        id: account.id,
        name: account.name,
        role: account.role,
        moderator: account.moderator,
      }
    : null;
export function failure(error: unknown) {
  if (error instanceof StoreError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(error);
  return Response.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}
