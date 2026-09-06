import { getSession } from "@/lib/auth/session";
import { RedeemError, revokeVirtualKey } from "@/lib/redeem/service";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    await rateLimitOrThrow(`revoke-key:${clientIp(request)}`, 20, 15 * 60 * 1000);

    const session = await getSession(request);
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }

    const { id } = await context.params;
    if (!/^key_[0-9a-fA-F-]{36}$/.test(id)) {
      return jsonError(400, "invalid_key_id", "Virtual key id failed validation.");
    }

    const key = await revokeVirtualKey({ userId: session.user.id, keyId: id });
    return Response.json({ key });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many revoke requests.");
    }
    if (error instanceof RedeemError) {
      return jsonError(error.status, error.message, "Revoke was rejected.");
    }
    return jsonError(400, "revoke_failed", error instanceof Error ? error.message : "revoke_failed");
  }
}
