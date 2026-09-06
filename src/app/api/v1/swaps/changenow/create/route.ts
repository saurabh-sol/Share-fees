import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { isSwapChainId } from "@/lib/changenow/assets";
import { openChangeNowPayin } from "@/lib/changenow/create";
import { ChangeNowError } from "@/lib/changenow/types";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";
import { changeNowCreateSchema } from "@/lib/validation/swap";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getSession(request);
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }
    await rateLimitOrThrow(`cnow:${session.user.id}`, 10, 15 * 60 * 1000);
    if (session.user.chainNamespace !== "eip155") {
      return jsonError(400, "evm_only", "Pay-ins are EVM-only.");
    }

    const body = changeNowCreateSchema.parse(await request.json());
    if (!isSwapChainId(body.fromChainId) || !isSwapChainId(body.toChainId)) {
      return jsonError(400, "unsupported_chain", "That chain pair is not enabled.");
    }

    const opened = await openChangeNowPayin({
      ...body,
      userId: session.user.id,
      sessionAddress: session.user.address,
    });
    return Response.json(opened);
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many pay-in requests.");
    }
    if (error instanceof ChangeNowError) {
      return jsonError(error.status, "changenow_create_failed", error.message);
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Create payload failed validation.");
    }
    return jsonError(400, "create_failed", error instanceof Error ? error.message : "create_failed");
  }
}
