import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { ChangeNowError } from "@/lib/changenow/types";
import { isSwapChainId } from "@/lib/changenow/assets";
import { computeRewardCents, getActiveRuleOrNull } from "@/lib/rules/engine";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";
import { routeSwapQuote } from "@/lib/swap/router";
import { quoteRequestSchema } from "@/lib/validation/swap";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await rateLimitOrThrow(`quote:${clientIp(request)}`, 30, 15 * 60 * 1000);

    const session = await getSession();
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }
    if (session.user.chainNamespace !== "eip155") {
      return jsonError(400, "evm_only", "Swap Studio is EVM-only. Sign in with MetaMask or Coinbase.");
    }

    const body = quoteRequestSchema.parse(await request.json());
    if (!isSwapChainId(body.fromChainId) || !isSwapChainId(body.toChainId)) {
      return jsonError(400, "unsupported_chain", "That chain pair is not enabled.");
    }

    const routed = await routeSwapQuote({
      ...body,
      fromAddress: session.user.address,
    });
    const rule = await getActiveRuleOrNull();
    const estimatedRewardCents = rule
      ? computeRewardCents(routed.fromAmountUsdCents, rule.conversionBps)
      : 0;
    const qualifies = Boolean(rule && routed.fromAmountUsdCents >= rule.minNotionalUsdCents);

    return Response.json({
      provider: routed.provider,
      quote: routed.quote,
      fromAmountUsdCents: routed.fromAmountUsdCents,
      estimatedRewardCents: qualifies ? estimatedRewardCents : 0,
      qualifies,
      paused: !rule,
      rule: rule
        ? {
            conversionBps: rule.conversionBps,
            minNotionalUsdCents: rule.minNotionalUsdCents,
            dailyCapUsdCents: rule.dailyCapUsdCents,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many quote requests.");
    }
    if (error instanceof ChangeNowError) {
      return jsonError(error.status, "changenow_quote_failed", error.message);
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Quote payload failed validation.");
    }
    return jsonError(502, "quote_failed", error instanceof Error ? error.message : "quote_failed");
  }
}
