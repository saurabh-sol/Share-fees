import { AdminError } from "@/lib/auth/admin";
import { assertJobCaller } from "@/lib/jobs/auth";
import { processPendingSettles } from "@/lib/jobs/settles";
import { OriginError, jsonError } from "@/lib/security/origin";

async function run(request: Request) {
  try {
    await assertJobCaller(request);
    const processed = await processPendingSettles();
    return Response.json({ processed });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof AdminError) {
      return jsonError(error.status, error.message, "Job auth failed.");
    }
    return jsonError(400, "settle_job_failed", error instanceof Error ? error.message : "settle_job_failed");
  }
}

export function GET(request: Request) {
  return run(request);
}

export function POST(request: Request) {
  return run(request);
}
