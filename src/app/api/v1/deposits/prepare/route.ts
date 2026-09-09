import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { DepositError, prepareDeposit } from "@/lib/deposit/service";
import { depositMinUsdCents } from "@/lib/deposit/credit";
import { AccrPriceUnavailableError } from "@/lib/pricing/dexscreener";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  usdAmount: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await rateLimitOrThrow(`deposit-prepare:${clientIp(request)}`, 30, 15 * 60 * 1000);

    const session = await getSession(request);
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }
    if (session.user.chainNamespace !== "eip155") {
      return jsonError(400, "evm_only", "Deposits are EVM-only. Connect MetaMask or Coinbase.");
    }

    const body = bodySchema.parse(await request.json());
    const result = await prepareDeposit({
      userId: session.user.id,
      usdAmount: body.usdAmount,
    });

    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many deposit quote requests.");
    }
    if (error instanceof AccrPriceUnavailableError) {
      return jsonError(503, "price_unavailable", error.message);
    }
    if (error instanceof DepositError) {
      if (error.message.startsWith("minimum_deposit_")) {
        const min = depositMinUsdCents();
        return jsonError(400, "minimum_deposit", `Minimum deposit is $${(min / 100).toFixed(2)}.`);
      }
      if (error.message === "deposit_wallet_unconfigured") {
        return jsonError(
          503,
          "deposit_unavailable",
          "Deposits are temporarily unavailable. Try again shortly.",
        );
      }
      return jsonError(error.status, error.message, error.message);
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Deposit payload failed validation.");
    }
    return jsonError(502, "prepare_failed", error instanceof Error ? error.message : "prepare_failed");
  }
}
