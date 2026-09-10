import { AdminError } from "@/lib/auth/admin";
import { aiCreateOverview } from "@/lib/ai-create/stats";
import { releaseStuckAiJobs } from "@/lib/ai-create/timeouts";
import { assertJobCaller } from "@/lib/jobs/auth";
import { OriginError, jsonError } from "@/lib/security/origin";

export const dynamic = "force-dynamic";

async function run(request: Request) {
  try {
    await assertJobCaller(request);
    const [released, aiCreate] = await Promise.all([releaseStuckAiJobs(), aiCreateOverview()]);
    if (aiCreate.nearBudget) {
      console.warn(
        `[ai-create] provider spend ${aiCreate.spendTodayCents}/${aiCreate.budgetCents} cents (${aiCreate.utilizationBps} bps)`,
      );
    }
    return Response.json({ released, aiCreate });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof AdminError) {
      return jsonError(error.status, error.message, "Job auth failed.");
    }
    return jsonError(
      400,
      "ai_create_job_failed",
      error instanceof Error ? error.message : "ai_create_job_failed",
    );
  }
}

export function GET(request: Request) {
  return run(request);
}

export function POST(request: Request) {
  return run(request);
}
