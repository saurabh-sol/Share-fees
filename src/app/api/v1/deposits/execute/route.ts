import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { DepositError, executeDeposit } from "@/lib/deposit/service";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  intentId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await rateLimitOrThrow(`deposit-execute:${clientIp(request)}`, 20, 15 * 60 * 1000);

    const session = await getSession(request);
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }
    if (session.user.chainNamespace !== "eip155") {
      return jsonError(400, "evm_only", "Deposits are EVM-only.");
    }

    const body = bodySchema.parse(await request.json());
    const payload = await executeDeposit({
      userId: session.user.id,
      intentId: body.intentId,
    });

    return Response.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many deposit requests.");
    }
    if (error instanceof DepositError) {
      const messages: Record<string, string> = {
        intent_not_found: "Deposit quote expired. Request a new quote.",
        intent_expired: "Deposit quote expired. Request a new quote.",
        intent_not_pending: "This deposit quote is no longer valid.",
      };
      return jsonError(error.status, error.message, messages[error.message] ?? error.message);
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Execute payload failed validation.");
    }
    return jsonError(502, "execute_failed", error instanceof Error ? error.message : "execute_failed");
  }
}
