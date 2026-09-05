import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { ClaimError, claimDiscoveredSwap } from "@/lib/indexer/claim";
import { LedgerError } from "@/lib/ledger/post-swap-reward";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";
import { claimRequestSchema } from "@/lib/validation/swap";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    await rateLimitOrThrow(`claim:${clientIp(request)}`, 20, 15 * 60 * 1000);

    const session = await getSession();
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }

    const { id } = await context.params;
    if (!/^disc_[0-9a-fA-F-]{36}$/.test(id)) {
      return jsonError(400, "invalid_claim_id", "Claim id failed validation.");
    }

    const body = claimRequestSchema.parse(await request.json());
    const result = await claimDiscoveredSwap({
      userId: session.user.id,
      address: session.user.address,
      claimId: id,
      rail: body.rail,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many claim requests.");
    }
    if (error instanceof ClaimError) {
      return jsonError(error.status, error.message, "Claim was rejected.");
    }
    if (error instanceof LedgerError) {
      return jsonError(error.status, error.message, "Ledger rejected the claim.");
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Claim payload failed validation.");
    }
    return jsonError(400, "claim_failed", error instanceof Error ? error.message : "claim_failed");
  }
}
