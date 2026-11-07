import { assertSameOrigin, failure, requireAccount } from "@/lib/auth.server";
import {
  clean,
  fileReport,
  rateLimit,
  StoreError,
  type TargetType,
} from "@/lib/store.server";

export const dynamic = "force-dynamic";
const types: TargetType[] = [
  "session",
  "note",
  "entry",
  "comment",
  "explanation",
];

/** Report a session, note or field note. Enough reports hide it until reviewed. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const account = await requireAccount();
    await rateLimit("report", account.id);
    const input = (await request.json()) as Record<string, unknown>;
    const type = input.type as TargetType;
    if (!types.includes(type)) throw new StoreError("Unknown content type.");
    const reason = clean.text(input.reason, 3, 300, "The reason");
    const result = await fileReport(
      type,
      String(input.id ?? ""),
      account.id,
      reason,
    );
    return Response.json(result, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
