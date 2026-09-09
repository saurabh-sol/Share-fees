import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { convertCredits } from "@/lib/ledger/convert";
import { LedgerError } from "@/lib/ledger/post-swap-reward";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";
import { convertCreditsSchema } from "@/lib/validation/swap";
import { UpgradePausedError, USDG_PAUSE_MESSAGE } from "@/lib/v2/upgrade";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await rateLimitOrThrow(`convert:${clientIp(request)}`, 30, 15 * 60 * 1000);

    const session = await getSession(request);
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }

    const body = convertCreditsSchema.parse(await request.json());
    const result = await convertCredits({
      userId: session.user.id,
      rail: body.rail,
      amountCents: body.amountCents,
      idempotencyKey: body.idempotencyKey,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many convert requests.");
    }
    if (error instanceof UpgradePausedError) {
      return jsonError(503, "rewards_paused", USDG_PAUSE_MESSAGE);
    }
    if (error instanceof LedgerError) {
      return jsonError(error.status, error.message, "Convert was rejected.");
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Convert payload failed validation.");
    }
    return jsonError(400, "convert_failed", error instanceof Error ? error.message : "convert_failed");
  }
}
