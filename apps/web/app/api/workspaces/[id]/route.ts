import { write } from "@/lib/route.server";
import {
  addItem,
  joinWorkspace,
  moveItem,
  setMemberRole,
} from "@/lib/workspaces.server";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
/** Join, add an item, move it along its board, or set a member’s role. */
export const POST = async (request: Request, { params }: Params) => {
  const { id } = await params;
  return write(request, "workspaceItem", async (account, body) => {
    switch (body.action) {
      case "join":
        return { role: await joinWorkspace(account, id) };
      case "move":
        return moveItem(account, id, String(body.item ?? ""), body.status);
      case "role":
        return setMemberRole(account, id, body.name, body.role);
      default:
        return { id: await addItem(account, id, body) };
    }
  });
};
