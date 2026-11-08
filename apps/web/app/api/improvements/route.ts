import { proposeImprovement } from "@/lib/improvements.server";
import { write } from "@/lib/route.server";

export const dynamic = "force-dynamic";
/** Propose an improvement to an attempt or a problem. */
export const POST = (request: Request) =>
  write(
    request,
    "improvement",
    async (account, body) => ({ id: await proposeImprovement(account, body) }),
    201,
  );
