import { cookies } from "next/headers";
import { z } from "zod";
import { consumeNonce } from "@/lib/auth/nonce";
import { normalizeAddress, type ChainNamespace } from "@/lib/auth/addresses";
import { createUserSession, sessionCookieOptions, upsertWalletUser } from "@/lib/auth/session";
import { verifySiweLogin } from "@/lib/auth/siwe";
import { extractSiwsNonce, verifySiwsLogin } from "@/lib/auth/siws";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";
import { verifyRequestSchema } from "@/lib/validation/swap";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    rateLimitOrThrow(`verify:${clientIp(request)}`, 8, 15 * 60 * 1000);

    const body = verifyRequestSchema.parse(await request.json());
    const namespace = body.chainNamespace as ChainNamespace;
    const address = normalizeAddress(namespace, body.address);

    if (namespace === "eip155") {
      if (!body.signature.startsWith("0x")) {
        return jsonError(400, "invalid_signature", "EVM signatures must be hex.");
      }
      const parsed = await verifySiweLogin(body.message, body.signature as `0x${string}`);
      if (parsed.address?.toLowerCase() !== address) {
        return jsonError(401, "address_mismatch", "Signed address does not match.");
      }
      if (!parsed.nonce) {
        return jsonError(400, "nonce_missing", "SIWE nonce missing.");
      }
      await consumeNonce({ nonce: parsed.nonce, namespace, address });
    } else {
      verifySiwsLogin({ address, message: body.message, signature: body.signature });
      await consumeNonce({
        nonce: extractSiwsNonce(body.message),
        namespace,
        address,
      });
    }

    const user = await upsertWalletUser(namespace, address);
    const session = await createUserSession(user);
    const jar = await cookies();
    const cookie = sessionCookieOptions();
    jar.set(cookie.name, session.token, cookie);

    return Response.json({
      user: {
        id: user.id,
        address: user.address,
        chainNamespace: user.chainNamespace,
      },
    });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many sign-in attempts.");
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Sign-in payload failed validation.");
    }
    return jsonError(401, "verify_failed", error instanceof Error ? error.message : "verify_failed");
  }
}
