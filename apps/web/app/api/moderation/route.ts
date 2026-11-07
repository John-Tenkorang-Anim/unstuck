import { assertSameOrigin, failure, requireAccount } from "@/lib/auth.server";
import {
  moderate,
  StoreError,
  type ModerationAction,
} from "@/lib/store.server";

export const dynamic = "force-dynamic";
const actions: ModerationAction[] = [
  "hide",
  "restore",
  "approve-file",
  "reject-file",
  "suspend",
  "unsuspend",
  "dismiss",
];

/** A moderator's decision. Every action needs a written explanation and is logged. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const account = await requireAccount();
    const input = (await request.json()) as Record<string, string>;
    if (!actions.includes(input.action as ModerationAction))
      throw new StoreError("Unknown action.");
    await moderate(
      account,
      input.action as ModerationAction,
      String(input.type ?? ""),
      String(input.id ?? ""),
      String(input.note ?? ""),
    );
    return Response.json({ done: true });
  } catch (error) {
    return failure(error);
  }
}
