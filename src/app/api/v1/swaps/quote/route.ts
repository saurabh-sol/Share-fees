import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chains/robinhood";
import { UniswapQuoteError } from "@/lib/uniswap/quote";
import { MIN_REWARD_CENTS, computeRewardCents, getActiveRuleOrNull } from "@/lib/rules/engine";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";
import { routeSwapQuote } from "@/lib/swap/router";
import { quoteRequestSchema } from "@/lib/validation/swap";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await rateLimitOrThrow(`quote:${clientIp(request)}`, 30, 15 * 60 * 1000);

    const session = await getSession(request);
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }
    if (session.user.chainNamespace !== "eip155") {
      return jsonError(400, "evm_only", "Swap Studio is EVM-only. Sign in with MetaMask or Coinbase.");
    }

    const body = quoteRequestSchema.parse(await request.json());
    if (body.fromChainId !== ROBINHOOD_CHAIN_ID || body.toChainId !== ROBINHOOD_CHAIN_ID) {
      return jsonError(
        400,
        "unsupported_chain",
        "Swap Studio is Robinhood-Chain-only (id 4663).",
      );
    }

    const origin = request.headers.get("origin") ?? "";
    const cookie = request.headers.get("cookie") ?? "";

    // Fetch token metadata (symbol, decimals, priceUSD) for the single chain.
    const tokenListResp = await fetch(
      `${origin}/api/v1/swaps/tokens?chainId=${body.fromChainId}`,
      { headers: { cookie } },
    ).catch(() => null);

    let fromTokenMeta:
      | { symbol: string; decimals: number; priceUSD?: string; logoURI?: string }
      | undefined;
    let toTokenMeta:
      | { symbol: string; decimals: number; priceUSD?: string; logoURI?: string }
      | undefined;

    if (tokenListResp?.ok) {
      const data = (await tokenListResp.json()) as {
        tokens: Array<{
          address: string;
          symbol: string;
          decimals: number;
          priceUSD?: string;
          logoURI?: string;
        }>;
      };
      fromTokenMeta = data.tokens.find(
        (t) => t.address.toLowerCase() === body.fromToken.toLowerCase(),
      );
      toTokenMeta = data.tokens.find(
        (t) => t.address.toLowerCase() === body.toToken.toLowerCase(),
      );
    }

    const routed = await routeSwapQuote({
      ...body,
      fromAddress: session.user.address,
      fromTokenMeta,
      toTokenMeta,
    });

    const rule = await getActiveRuleOrNull();
    const estimatedRewardCents = rule
      ? computeRewardCents(routed.fromAmountUsdCents, rule.conversionBps)
      : 0;
    const qualifies = Boolean(
      rule &&
        routed.fromAmountUsdCents >= rule.minNotionalUsdCents &&
        estimatedRewardCents >= MIN_REWARD_CENTS,
    );

    return Response.json(
      {
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
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many quote requests.");
    }
    if (error instanceof UniswapQuoteError) {
      return jsonError(error.status, "uniswap_quote_failed", error.message);
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Quote payload failed validation.");
    }
    return jsonError(502, "quote_failed", error instanceof Error ? error.message : "quote_failed");
  }
}
