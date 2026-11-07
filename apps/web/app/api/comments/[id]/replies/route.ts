import { currentAccount, failure } from "@/lib/auth.server";
import { listReplies } from "@/lib/discussion.server";

export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = (await params).id;
    if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ items: [] });
    const viewer = await currentAccount();
    return Response.json({ items: await listReplies(id, viewer?.id) });
  } catch (error) {
    return failure(error);
  }
}
