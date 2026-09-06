import { getSession } from "@/lib/auth/session";
import { listVirtualKeys } from "@/lib/redeem/service";
import { jsonError } from "@/lib/security/origin";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }
  const keys = await listVirtualKeys(session.user.id);
  return Response.json({ keys });
}
