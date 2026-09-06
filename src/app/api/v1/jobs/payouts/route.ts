import { AdminError } from "@/lib/auth/admin";
import { assertJobCaller } from "@/lib/jobs/auth";
import { processPayoutOutbox } from "@/lib/jobs/payouts";
import { OriginError, jsonError } from "@/lib/security/origin";

async function run(request: Request) {
  try {
    await assertJobCaller(request);
    const processed = await processPayoutOutbox();
    return Response.json({ processed });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof AdminError) {
      return jsonError(error.status, error.message, "Job auth failed.");
    }
    return jsonError(400, "payout_job_failed", error instanceof Error ? error.message : "payout_job_failed");
  }
}

export function GET(request: Request) {
  return run(request);
}

export function POST(request: Request) {
  return run(request);
}
