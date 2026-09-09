import { AdminError } from "@/lib/auth/admin";
import { assertJobCaller } from "@/lib/jobs/auth";
import { processDueHolderVerifications } from "@/lib/holder/service";
import { OriginError, jsonError } from "@/lib/security/origin";

async function run(request: Request) {
  try {
    await assertJobCaller(request);
    const result = await processDueHolderVerifications();
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof AdminError) {
      return jsonError(error.status, error.message, "Job auth failed.");
    }
    return jsonError(400, "holder_job_failed", error instanceof Error ? error.message : "holder_job_failed");
  }
}

export function GET(request: Request) {
  return run(request);
}

export function POST(request: Request) {
  return run(request);
}
