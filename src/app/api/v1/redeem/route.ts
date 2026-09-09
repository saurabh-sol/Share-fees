import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { RedeemError, listRedemptions, redeem } from "@/lib/redeem/service";
import { usdgRedeemErrorMessage } from "@/lib/redeem/limits";
import { UpgradePausedError, USDG_PAUSE_MESSAGE } from "@/lib/v2/upgrade";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";
import { clearPublicDeskStatsCache } from "@/lib/stats/public";
import { redeemRequestSchema } from "@/lib/validation/swap";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }
  const rows = await listRedemptions(session.user.id);
  return Response.json({ redemptions: rows });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await rateLimitOrThrow(`redeem:${clientIp(request)}`, 20, 15 * 60 * 1000);

    const session = await getSession(request);
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }

    const body = redeemRequestSchema.parse(await request.json());
    const result = await redeem({
      userId: session.user.id,
      address: session.user.address,
      chainNamespace: session.user.chainNamespace === "solana" ? "solana" : "eip155",
      rail: body.rail,
      amountCents: body.amountCents,
      idempotencyKey: body.idempotencyKey,
      provider: body.provider,
      model: body.model,
      clientIp: clientIp(request),
    });

    if (!result.alreadyExists) {
      clearPublicDeskStatsCache();
    }

    return Response.json({
      ...result,
      rail: body.rail,
      provider: body.provider,
      model: body.model,
    });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many redeem requests.");
    }
    if (error instanceof UpgradePausedError) {
      return jsonError(503, "rewards_paused", USDG_PAUSE_MESSAGE);
    }
    if (error instanceof RedeemError) {
      const headers =
        error.retryAfterSec != null ? { "Retry-After": String(error.retryAfterSec) } : undefined;
      return jsonError(
        error.status,
        error.message,
        usdgRedeemErrorMessage(error.message),
        headers,
      );
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Redeem payload failed validation.");
    }
    return jsonError(400, "redeem_failed", error instanceof Error ? error.message : "redeem_failed");
  }
}
