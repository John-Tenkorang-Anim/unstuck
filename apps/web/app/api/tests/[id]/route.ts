import { write } from "@/lib/route.server";
import { updateTest } from "@/lib/tests.server";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
/** Record a run, results or findings. */
export const POST = async (request: Request, { params }: Params) => {
  const { id } = await params;
  return write(request, "test", (account, body) =>
    updateTest(account, id, body),
  );
};
