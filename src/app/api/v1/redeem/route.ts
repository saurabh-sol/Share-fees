import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { RedeemError, listRedemptions, redeem } from "@/lib/redeem/service";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";
import { redeemRequestSchema } from "@/lib/validation/swap";

export async function GET() {
  const session = await getSession();
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

    const session = await getSession();
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
    });

    return Response.json({
      ...result,
      rail: body.rail,
    });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many redeem requests.");
    }
    if (error instanceof RedeemError) {
      return jsonError(error.status, error.message, "Redeem was rejected.");
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Redeem payload failed validation.");
    }
    return jsonError(400, "redeem_failed", error instanceof Error ? error.message : "redeem_failed");
  }
}
