import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { DepositError, confirmDeposit } from "@/lib/deposit/service";
import { clearPublicDeskStatsCache } from "@/lib/stats/public";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  intentId: z.string().min(1),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await rateLimitOrThrow(`deposit-confirm:${clientIp(request)}`, 20, 15 * 60 * 1000);

    const session = await getSession(request);
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }
    if (session.user.chainNamespace !== "eip155") {
      return jsonError(400, "evm_only", "Deposits are EVM-only.");
    }

    const body = bodySchema.parse(await request.json());
    const result = await confirmDeposit({
      userId: session.user.id,
      intentId: body.intentId,
      txHash: body.txHash,
      walletAddress: session.user.address,
    });

    if (!result.alreadyExists) {
      clearPublicDeskStatsCache();
    }

    return Response.json(
      {
        depositId: result.depositId,
        displayCreditCents: result.displayCreditCents,
        txHash: result.txHash,
        llmCents: result.llmCents,
        alreadyExists: result.alreadyExists,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many deposit confirmations.");
    }
    if (error instanceof DepositError) {
      return jsonError(error.status, error.message, error.message);
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Confirm payload failed validation.");
    }
    const message = error instanceof Error ? error.message : "confirm_failed";
    if (message === "transfer_not_found" || message === "transfer_amount_too_low") {
      return jsonError(400, message, "On-chain transfer did not match the quoted deposit.");
    }
    if (message === "tx_reverted") {
      return jsonError(400, message, "The transaction did not succeed on-chain.");
    }
    return jsonError(502, "confirm_failed", message);
  }
}
