import { getImprovement } from "@/lib/improvements.server";
import { problemOrFail } from "@/lib/problems.server";
import { write } from "@/lib/route.server";
import { StoreError } from "@/lib/store.server";
import { createTest } from "@/lib/tests.server";

export const dynamic = "force-dynamic";
/** Start a test for a proposal, or for a problem directly. */
export const POST = (request: Request) =>
  write(
    request,
    "test",
    async (account, body) => {
      const improvement = body.improvementId
        ? await getImprovement(String(body.improvementId), account.id)
        : undefined;
      if (body.improvementId && !improvement)
        throw new StoreError("That proposal doesn’t exist.", 404);
      const problemId =
        improvement?.problemId ??
        (body.problemId ? String(body.problemId) : undefined);
      if (problemId) await problemOrFail(problemId);
      if (!improvement && !problemId)
        throw new StoreError("Choose what this test evaluates.");
      return {
        id: await createTest(account, body, {
          improvementId: improvement?.id,
          entryId: improvement?.entryId,
          problemId,
        }),
      };
    },
    201,
  );
