import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { fetchLifiQuote, isAllowedChainId } from "@/lib/lifi/http";
import { usdToCents } from "@/lib/lifi/notional";
import { computeRewardCents, getActiveRule } from "@/lib/rules/engine";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";
import { quoteRequestSchema } from "@/lib/validation/swap";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    rateLimitOrThrow(`quote:${clientIp(request)}`, 30, 15 * 60 * 1000);

    const session = await getSession();
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }
    if (session.user.chainNamespace !== "eip155") {
      return jsonError(400, "evm_only", "Swap Studio is EVM-only in Phase 1. Sign in with MetaMask or Coinbase.");
    }

    const body = quoteRequestSchema.parse(await request.json());
    if (!isAllowedChainId(body.fromChainId) || !isAllowedChainId(body.toChainId)) {
      return jsonError(400, "unsupported_chain", "That chain pair is not enabled.");
    }

    const quote = await fetchLifiQuote({
      ...body,
      fromAddress: session.user.address,
    });
    const rule = await getActiveRule();
    const fromAmountUsdCents = quote.estimate.fromAmountUSD
      ? usdToCents(quote.estimate.fromAmountUSD)
      : 0;
    const estimatedRewardCents = computeRewardCents(fromAmountUsdCents, rule.conversionBps);

    return Response.json({
      quote,
      fromAmountUsdCents,
      estimatedRewardCents: fromAmountUsdCents >= rule.minNotionalUsdCents ? estimatedRewardCents : 0,
      qualifies: fromAmountUsdCents >= rule.minNotionalUsdCents,
      rule: {
        conversionBps: rule.conversionBps,
        minNotionalUsdCents: rule.minNotionalUsdCents,
        dailyCapUsdCents: rule.dailyCapUsdCents,
      },
    });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many quote requests.");
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Quote payload failed validation.");
    }
    return jsonError(502, "quote_failed", error instanceof Error ? error.message : "quote_failed");
  }
}
