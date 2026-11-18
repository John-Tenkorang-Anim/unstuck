import { offerHelp, respondToHelp } from "@/lib/help.server";
import { write } from "@/lib/route.server";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
/** Offer help, or (as the asker) accept, decline, mark helped, close or reopen. */
export const POST = async (request: Request, { params }: Params) => {
  const { id } = await params;
  return write(request, "offer", async (account, body) =>
    body.action === "offer"
      ? { id: await offerHelp(account, id, body) }
      : respondToHelp(account, id, body),
  );
};
