import { write } from "@/lib/route.server";
import { createWorkspace } from "@/lib/workspaces.server";

export const dynamic = "force-dynamic";
/** Start a workspace, optionally around a problem. */
export const POST = (request: Request) =>
  write(
    request,
    "workspace",
    async (account, body) => ({ id: await createWorkspace(account, body) }),
    201,
  );
