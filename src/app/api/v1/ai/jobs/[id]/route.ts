import { getSession } from "@/lib/auth/session";
import { getAiJob } from "@/lib/ai-create/jobs";
import { jsonError } from "@/lib/security/origin";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }

  const { id } = await context.params;
  if (!/^aig_[0-9a-fA-F-]{36}$/.test(id)) {
    return jsonError(400, "invalid_job_id", "Job id failed validation.");
  }

  const job = await getAiJob(id, session.user.id);
  if (!job) {
    return jsonError(404, "job_not_found", "Generation job was not found.");
  }

  return Response.json({ job }, { headers: { "Cache-Control": "private, no-store" } });
}
