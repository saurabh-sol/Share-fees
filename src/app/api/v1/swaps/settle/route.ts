import { z } from "zod";
import { assertTxHash } from "@/lib/auth/addresses";
import { getSession } from "@/lib/auth/session";
import { upsertPendingSettle } from "@/lib/jobs/pending";
import { LedgerError, postSwapReward } from "@/lib/ledger/post-swap-reward";
import { SettleError, readVerifiedFill } from "@/lib/lifi/settle";
import { isUniswapChainId, type UniswapChainId } from "@/lib/uniswap/constants";
import { verifyUniswapFill, UniswapSettleError } from "@/lib/uniswap/settle";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";
import { settleSwapSchema } from "@/lib/validation/swap";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await rateLimitOrThrow(`settle:${clientIp(request)}`, 20, 15 * 60 * 1000);

    const session = await getSession(request);
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }

    const body = settleSwapSchema.parse(await request.json());
    const txHash = assertTxHash("eip155", body.txHash);

    if (body.provider === "uniswap") {
      const chainId = Number(body.fromChain);
      if (!isUniswapChainId(chainId)) {
        return jsonError(400, "unsupported_chain", "Uniswap is not available on this chain.");
      }

      const verified = await verifyUniswapFill({
        txHash,
        chainId: chainId as UniswapChainId,
        sessionAddress: session.user.address,
        expectedFromToken: body.fromToken ?? "",
        expectedToToken: body.toToken ?? "",
        expectedNotionalCents: body.notionalUsdCents ?? 0,
      });

      if (verified.kind === "pending") {
        await upsertPendingSettle({
          userId: session.user.id,
          provider: "uniswap",
          txHash,
          fromChain: body.fromChain,
          toChain: body.toChain,
        });
        return Response.json({ status: "pending", provider: "uniswap" }, { status: 202 });
      }

      const result = await postSwapReward({
        userId: session.user.id,
        source: "in_app",
        txHash,
        fromChain: body.fromChain,
        toChain: body.toChain,
        fromToken: verified.fromToken,
        toToken: verified.toToken,
        fromAmount: verified.fromAmount,
        toAmount: verified.toAmount,
        notionalUsdCents: verified.notionalUsdCents,
        executedAt: new Date(),
      });

      return Response.json({
        ...result,
        notionalUsdCents: verified.notionalUsdCents,
        provider: "uniswap",
      });
    }

    // LI.FI path (cross-chain or fallback)
    const verified = await readVerifiedFill({
      txHash,
      fromChain: body.fromChain,
      toChain: body.toChain,
      sessionAddress: session.user.address,
    });

    if (verified.kind === "pending") {
      await upsertPendingSettle({
        userId: session.user.id,
        provider: "lifi",
        txHash,
        fromChain: body.fromChain,
        toChain: body.toChain,
      });
      return Response.json({ status: "pending", lifiStatus: verified.status.status }, { status: 202 });
    }

    const result = await postSwapReward({
      userId: session.user.id,
      source: "in_app",
      txHash: verified.executedHash.toLowerCase().startsWith("0x")
        ? verified.executedHash.toLowerCase()
        : txHash,
      fromChain: body.fromChain,
      toChain: body.toChain,
      fromToken: verified.fromToken,
      toToken: verified.toToken,
      fromAmount: verified.fromAmount,
      toAmount: verified.toAmount,
      notionalUsdCents: verified.notionalUsdCents,
      executedAt: new Date(),
    });

    return Response.json({
      ...result,
      notionalUsdCents: verified.notionalUsdCents,
      lifiStatus: "DONE",
      provider: "lifi",
    });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many settle requests.");
    }
    if (error instanceof UniswapSettleError) {
      return jsonError(error.status, "uniswap_settle_failed", error.message);
    }
    if (error instanceof SettleError) {
      return jsonError(error.status, error.message, "Swap router status was rejected.");
    }
    if (error instanceof LedgerError) {
      return jsonError(error.status, error.message, "Ledger rejected the fill.");
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Settle payload failed validation.");
    }
    return jsonError(400, "settle_failed", error instanceof Error ? error.message : "settle_failed");
  }
}
