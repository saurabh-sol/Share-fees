import { z } from "zod";
import { issueNonce } from "@/lib/auth/nonce";
import { normalizeAddress, type ChainNamespace } from "@/lib/auth/addresses";
import { nonceRequestSchema } from "@/lib/validation/swap";
import { assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";
import { OriginError } from "@/lib/security/origin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await rateLimitOrThrow(`nonce:${clientIp(request)}`, 12, 15 * 60 * 1000);

    const body = nonceRequestSchema.parse(await request.json());
    const address = normalizeAddress(body.chainNamespace as ChainNamespace, body.address);
    const nonce = await issueNonce(body.chainNamespace, address);
    const issuedAt = new Date().toISOString();
    const expirationTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    return Response.json({
      nonce,
      issuedAt,
      expirationTime,
    });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many nonce requests.");
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Address payload failed validation.");
    }
    return jsonError(
      500,
      "nonce_failed",
      error instanceof Error ? error.message : "Could not issue a login nonce.",
    );
  }
}
