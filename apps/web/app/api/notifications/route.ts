import { activityFor } from "@/lib/activity.server";
import { currentAccount, failure } from "@/lib/auth.server";
import { hasDatabase } from "@/lib/db.server";

export const dynamic = "force-dynamic";

/**
 * What's new for the person signed in: replies, updates to what they follow
 * or posted, and things waiting for their answer. Reading doesn't mark seen.
 */
export async function GET() {
  try {
    const account = hasDatabase() ? await currentAccount() : undefined;
    if (!account) return Response.json({ count: 0, items: [] });
    const items = (await activityFor(account))
      .filter((i) => i.fresh === true || i.kind === "review")
      .slice(0, 12)
      .map((i) => ({
        href: i.href,
        title: i.title,
        detail: i.detail,
        at: i.at,
      }));
    return Response.json(
      { count: items.length, items },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
