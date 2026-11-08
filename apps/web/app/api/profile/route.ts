import { updateProfile } from "@/lib/profile.server";
import { write } from "@/lib/route.server";

export const dynamic = "force-dynamic";
/** Update affiliation, bio, interests, links or what brought someone here. */
export const POST = (request: Request) =>
  write(request, null, (account, body) => updateProfile(account, body));
