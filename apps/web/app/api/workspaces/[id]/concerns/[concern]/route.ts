import { write } from "@/lib/route.server";
import { supportConcern, updateConcern } from "@/lib/concerns.server";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; concern: string }> },
) {
  const { id, concern } = await params;
  return write(request, "workspaceItem", async (account, body) =>
    body.action === "support"
      ? supportConcern(account, id, concern, body.on === true)
      : { id: await updateConcern(account, id, concern, body) },
  );
}
