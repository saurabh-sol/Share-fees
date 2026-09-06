import { getSession } from "@/lib/auth/session";
import { getRedemptionForUser } from "@/lib/redeem/service";
import { jsonError } from "@/lib/security/origin";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }

  const { id } = await context.params;
  if (!/^rdm_[0-9a-fA-F-]{36}$/.test(id)) {
    return jsonError(400, "invalid_redemption_id", "Redemption id failed validation.");
  }

  const detail = await getRedemptionForUser(session.user.id, id);
  if (!detail) {
    return jsonError(404, "not_found", "Redemption was not found.");
  }
  return Response.json(detail);
}
