import { getSession } from "@/lib/auth/session";
import { getAiCreateBalance } from "@/lib/ai-create/jobs";
import { jsonError } from "@/lib/security/origin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }

  const balance = await getAiCreateBalance(session.user.id);
  return Response.json(balance, { headers: { "Cache-Control": "private, no-store" } });
}
