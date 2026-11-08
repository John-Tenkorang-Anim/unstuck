import { setFollow } from "@/lib/follows.server";
import { write } from "@/lib/route.server";

export const dynamic = "force-dynamic";
/** Follow or unfollow a problem, proposal, category, person or workspace. */
export const POST = (request: Request) =>
  write(request, "join", (account, body) =>
    setFollow(account, body.type, body.id, body.on !== false),
  );
