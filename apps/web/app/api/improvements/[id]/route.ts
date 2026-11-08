import {
  addImprovementEvent,
  resolveImprovementEvent,
  reviseImprovement,
  setImprovementStatus,
} from "@/lib/improvements.server";
import { write } from "@/lib/route.server";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
/**
 * Everything that happens to a proposal: discussion, marking a question
 * answered, revising it, and moving it through its lifecycle.
 */
export const POST = async (request: Request, { params }: Params) => {
  const { id } = await params;
  return write(request, "improvement", async (account, body) => {
    switch (body.action) {
      case "status":
        return { status: await setImprovementStatus(account, id, body) };
      case "revise":
        return reviseImprovement(account, id, body);
      case "resolve":
        return resolveImprovementEvent(
          account,
          id,
          String(body.event ?? ""),
          body.resolved !== false,
        );
      default:
        return { id: await addImprovementEvent(account, id, body) };
    }
  });
};
