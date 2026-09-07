import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { confirmOnChainClaim, RedeemError } from "@/lib/redeem/service";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";
import { confirmOnChainClaimSchema } from "@/lib/validation/swap";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    await rateLimitOrThrow(`redeem-confirm:${clientIp(request)}`, 30, 15 * 60 * 1000);

    const session = await getSession(request);
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }

    const { id } = await context.params;
    if (!/^rdm_[0-9a-fA-F-]{36}$/.test(id)) {
      return jsonError(400, "invalid_redemption_id", "Redemption id failed validation.");
    }

    const body = confirmOnChainClaimSchema.parse(await request.json());
    const result = await confirmOnChainClaim({
      userId: session.user.id,
      redemptionId: id,
      txHash: body.txHash,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many claim confirmations.");
    }
    if (error instanceof RedeemError) {
      return jsonError(error.status, error.message, "On-chain claim was rejected.");
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Claim confirmation failed validation.");
    }
    return jsonError(
      400,
      "claim_confirm_failed",
      error instanceof Error ? error.message : "claim_confirm_failed",
    );
  }
}
