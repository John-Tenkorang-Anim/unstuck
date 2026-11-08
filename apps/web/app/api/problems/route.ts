import { createProblem } from "@/lib/problems.server";
import { write } from "@/lib/route.server";

export const dynamic = "force-dynamic";
/** Describe a problem you need help with. */
export const POST = (request: Request) =>
  write(
    request,
    "problem",
    async (account, body) => ({ id: await createProblem(account, body) }),
    201,
  );
