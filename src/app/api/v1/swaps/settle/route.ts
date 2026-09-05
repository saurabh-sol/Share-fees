import { z } from "zod";
import { assertTxHash } from "@/lib/auth/addresses";
import { getSession } from "@/lib/auth/session";
import { LedgerError, postSwapReward } from "@/lib/ledger/post-swap-reward";
import { SettleError, readVerifiedFill } from "@/lib/lifi/settle";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";
import { settleSwapSchema } from "@/lib/validation/swap";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    rateLimitOrThrow(`settle:${clientIp(request)}`, 20, 15 * 60 * 1000);

    const session = await getSession();
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }

    const body = settleSwapSchema.parse(await request.json());
    const txHash = assertTxHash("eip155", body.txHash);
    const verified = await readVerifiedFill({
      txHash,
      fromChain: body.fromChain,
      toChain: body.toChain,
      sessionAddress: session.user.address,
    });

    if (verified.kind === "pending") {
      return Response.json(
        { status: "pending", lifiStatus: verified.status.status },
        { status: 202 },
      );
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
      rail: body.rail,
    });

    return Response.json({
      ...result,
      notionalUsdCents: verified.notionalUsdCents,
      lifiStatus: "DONE",
    });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many settle requests.");
    }
    if (error instanceof SettleError) {
      return jsonError(error.status, error.message, "LI.FI status was rejected.");
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
