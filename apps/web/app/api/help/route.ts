import { createHelp } from "@/lib/help.server";
import { write } from "@/lib/route.server";

export const dynamic = "force-dynamic";
/** Ask for help; the request is routed to people who’ve been somewhere similar. */
export const POST = (request: Request) =>
  write(
    request,
    "help",
    async (account, body) => ({ id: await createHelp(account, body) }),
    201,
  );
