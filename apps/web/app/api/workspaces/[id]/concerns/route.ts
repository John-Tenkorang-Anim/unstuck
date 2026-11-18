import { write } from "@/lib/route.server";
import { raiseConcern } from "@/lib/concerns.server";
export const dynamic = "force-dynamic";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return write(
    request,
    "workspaceItem",
    async (account, body) => ({ id: await raiseConcern(account, id, body) }),
    201,
  );
}
