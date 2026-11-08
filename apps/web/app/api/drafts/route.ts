import { deleteDraft, saveDraft } from "@/lib/drafts.server";
import { write } from "@/lib/route.server";

export const dynamic = "force-dynamic";
/** Save a draft, or delete one with { delete: id }. */
export const POST = (request: Request) =>
  write(request, "draft", async (account, body) =>
    typeof body.delete === "string"
      ? deleteDraft(account, body.delete)
      : { id: await saveDraft(account, body) },
  );
