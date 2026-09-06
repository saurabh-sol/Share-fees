import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { ClaimError } from "@/lib/indexer/claim";
import { importHistoricalHash } from "@/lib/indexer/import-hash";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";
import { importHashSchema } from "@/lib/validation/swap";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await rateLimitOrThrow(`import:${clientIp(request)}`, 12, 15 * 60 * 1000);

    const session = await getSession(request);
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }

    const body = importHashSchema.parse(await request.json());
    const result = await importHistoricalHash({
      userId: session.user.id,
      address: session.user.address,
      txHash: body.txHash,
      fromChain: body.fromChain,
      toChain: body.toChain,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many import requests.");
    }
    if (error instanceof ClaimError) {
      return jsonError(error.status, error.message, "Hash could not be verified as yours.");
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Import payload failed validation.");
    }
    return jsonError(400, "import_failed", error instanceof Error ? error.message : "import_failed");
  }
}
