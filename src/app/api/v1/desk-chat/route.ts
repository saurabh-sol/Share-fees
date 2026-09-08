import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { deskChatStatus, handleDeskChat } from "@/lib/gateway/desk-chat";
import { GatewayError } from "@/lib/gateway/errors";
import { OriginError, assertSameOrigin, clientIp, jsonError } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";
import { deskChatSchema } from "@/lib/validation/swap";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }
  const status = await deskChatStatus(session.user.id);
  return Response.json(status, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await getSession(request);
    if (!session) {
      return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
    }
    await rateLimitOrThrow(`desk-chat:${session.user.id}`, 20, 60_000);
    const body = deskChatSchema.parse(await request.json());
    const result = await handleDeskChat({
      userId: session.user.id,
      provider: body.provider,
      model: body.model,
      messages: body.messages,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof RateLimitError) {
      return jsonError(429, "rate_limited", "Too many chat turns. Wait a minute.");
    }
    if (error instanceof GatewayError) {
      const copy =
        error.message === "redeem_required"
          ? "Redeem LLM credits first. Scan and claim only posts website credit until you redeem an acc_ key."
          : error.message === "insufficient_credits"
          ? "Your redeemed LLM key has no balance left. Redeem again from /app/redeem."
          : error.message === "provider_pool_empty"
            ? "The model upstream is not configured on this desk."
            : error.message === "invalid_llm_model" || error.message === "invalid_llm_provider"
              ? "That provider or model is not on the desk catalog."
              : error.message;
      return jsonError(error.status, error.message, copy);
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Chat payload failed validation.");
    }
    return jsonError(400, "desk_chat_failed", error instanceof Error ? error.message : "desk_chat_failed");
  }
}
