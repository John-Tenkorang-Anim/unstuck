import { assertSameOrigin, failure, requireAccount } from "@/lib/auth.server";
import { recordIncidentReport } from "@/lib/store.server";

export const dynamic = "force-dynamic";
/** Record the reference of the report a moderator filed with the authorities. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const account = await requireAccount();
    const { reference } = (await request.json()) as { reference?: string };
    await recordIncidentReport(
      account,
      (await params).id,
      String(reference ?? ""),
    );
    return Response.json({ recorded: true });
  } catch (error) {
    return failure(error);
  }
}
