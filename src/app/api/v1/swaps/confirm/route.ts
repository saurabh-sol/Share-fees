import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { LedgerError, postSwapReward } from "@/lib/ledger/post-swap-reward";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";
import { confirmSwapSchema } from "@/lib/validation/swap";
import { assertTxHash, type ChainNamespace } from "@/lib/auth/addresses";

export async function POST(request: Request) {
  try {
    if (!env.allowMockSwaps) {
      return jsonError(403, "mock_disabled", "Paper fills are disabled on this host.");
    }
    assertSameOrigin(request);
    await rateLimitOrThrow(`confirm:${clientIp(request)}`, 20, 15 * 60 * 1000);

    const session = await getSession();
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }

    const body = confirmSwapSchema.parse(await request.json());
    const executedAt = new Date(body.executedAt);
    const now = Date.now();
    if (executedAt.getTime() > now + 5 * 60 * 1000) {
      return jsonError(400, "future_fill", "executedAt cannot be in the future.");
    }
    if (now - executedAt.getTime() > 90 * 24 * 60 * 60 * 1000) {
      return jsonError(400, "stale_fill", "executedAt is older than 90 days.");
    }

    const namespace = session.user.chainNamespace as ChainNamespace;
    const txHash = assertTxHash(namespace === "solana" ? "solana" : "eip155", body.txHash);

    const result = await postSwapReward({
      userId: session.user.id,
      source: "mock",
      txHash,
      fromChain: body.fromChain,
      toChain: body.toChain,
      fromToken: body.fromToken,
      toToken: body.toToken,
      fromAmount: body.fromAmount,
      toAmount: body.toAmount,
      notionalUsdCents: body.notionalUsdCents,
      executedAt,
      rail: body.rail,
    });

    return Response.json(result);
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many confirm requests.");
    }
    if (error instanceof LedgerError) {
      return jsonError(error.status, error.message, "Ledger rejected the fill.");
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Swap payload failed validation.");
    }
    return jsonError(400, "confirm_failed", error instanceof Error ? error.message : "confirm_failed");
  }
}
