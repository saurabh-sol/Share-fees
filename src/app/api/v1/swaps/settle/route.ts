import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { assertTxHash } from "@/lib/auth/addresses";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { discoveredSwaps } from "@/lib/db/schema";
import { upsertPendingSettle } from "@/lib/jobs/pending";
import { LedgerError, postSwapReward, newLedgerId } from "@/lib/ledger/post-swap-reward";
import { isUniswapChainId, type UniswapChainId } from "@/lib/uniswap/constants";
import { verifyUniswapFill, UniswapSettleError } from "@/lib/uniswap/settle";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";
import { clearPublicDeskStatsCache } from "@/lib/stats/public";
import { settleSwapSchema } from "@/lib/validation/swap";

/**
 * Mirror an in-app Uniswap swap into `discoveredSwaps` as a booked entry.
 * This makes the swap show up in the wallet activity/volume total immediately
 * without requiring a wallet scan pass.
 */
async function recordAsActivity(input: {
  userId: string;
  txHash: string;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  notionalUsdCents: number;
  executedAt: Date;
}) {
  const db = await getDb();
  const [existing] = await db
    .select({ id: discoveredSwaps.id })
    .from(discoveredSwaps)
    .where(
      and(
        eq(discoveredSwaps.txHash, input.txHash),
        eq(discoveredSwaps.fromChain, input.fromChain),
      ),
    )
    .limit(1);

  if (existing) return;

  try {
    await db.insert(discoveredSwaps).values({
      id: newLedgerId("disc"),
      userId: input.userId,
      provider: "uniswap",
      txHash: input.txHash,
      fromChain: input.fromChain,
      toChain: input.toChain,
      fromToken: input.fromToken,
      toToken: input.toToken,
      fromAmount: input.fromAmount,
      toAmount: input.toAmount,
      notionalUsdCents: input.notionalUsdCents,
      kind: "trade",
      executedAt: input.executedAt,
      status: "booked",
      claimedAt: new Date(),
    });
  } catch {
    // Race with a concurrent insert (unique index on tx+chain). Safe to ignore.
  }
}

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

    if (body.provider !== "uniswap") {
      return jsonError(
        400,
        "unsupported_provider",
        "Only Uniswap swaps are supported. LI.FI bridging is disabled.",
      );
    }

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

    const executedAt = new Date();
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
      executedAt,
    });

    // Ensure the swap is visible in the wallet activity list + volume total.
    if (!result.alreadyExists) {
      clearPublicDeskStatsCache();
      await recordAsActivity({
        userId: session.user.id,
        txHash,
        fromChain: body.fromChain,
        toChain: body.toChain,
        fromToken: verified.fromToken,
        toToken: verified.toToken,
        fromAmount: verified.fromAmount,
        toAmount: verified.toAmount,
        notionalUsdCents: verified.notionalUsdCents,
        executedAt,
      });
    }

    return Response.json({
      ...result,
      notionalUsdCents: verified.notionalUsdCents,
      provider: "uniswap",
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
    if (error instanceof LedgerError) {
      return jsonError(error.status, error.message, "Ledger rejected the fill.");
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Settle payload failed validation.");
    }
    return jsonError(400, "settle_failed", error instanceof Error ? error.message : "settle_failed");
  }
}
