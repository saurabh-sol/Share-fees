import { z } from "zod";
import { gatewayJson, gatewayPreflight, withGatewayCors } from "@/lib/gateway/cors";
import { GatewayError, handleChatCompletion } from "@/lib/gateway/service";
import { clientIp } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";

export async function OPTIONS() {
  return gatewayPreflight();
}

export async function POST(request: Request) {
  try {
    await rateLimitOrThrow(`gateway-ip:${clientIp(request)}`, 60, 60 * 1000);
    const body = await request.json();
    const response = await handleChatCompletion({
      authorization: request.headers.get("authorization"),
      body,
    });
    return withGatewayCors(response);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return gatewayJson(429, { error: { message: "rate_limited", type: "rate_limit_error" } });
    }
    if (error instanceof GatewayError) {
      return gatewayJson(error.status, {
        error: { message: error.message, type: "invalid_request_error" },
      });
    }
    if (error instanceof z.ZodError) {
      return gatewayJson(400, { error: { message: "invalid_body", type: "invalid_request_error" } });
    }
    return gatewayJson(400, {
      error: {
        message: error instanceof Error ? error.message : "gateway_failed",
        type: "invalid_request_error",
      },
    });
  }
}
