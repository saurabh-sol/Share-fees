import { gatewayJson, gatewayPreflight } from "@/lib/gateway/cors";
import { modelsForProvider } from "@/lib/gateway/catalog";
import { GatewayError, authenticateVirtualKey, readBearerToken } from "@/lib/gateway/service";
import { clientIp } from "@/lib/security/origin";
import { RateLimitError, rateLimitOrThrow } from "@/lib/security/rate-limit";

export async function OPTIONS() {
  return gatewayPreflight();
}

export async function GET(request: Request) {
  try {
    await rateLimitOrThrow(`gateway-models:${clientIp(request)}`, 60, 60 * 1000);
    const raw = readBearerToken(request.headers.get("authorization"));
    const key = await authenticateVirtualKey(raw);
    const provider = key.provider;
    return gatewayJson(200, {
      object: "list",
      data: modelsForProvider(provider).map((item) => ({
        id: item.id,
        object: "model",
        owned_by: provider,
      })),
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return gatewayJson(429, { error: { message: "rate_limited", type: "rate_limit_error" } });
    }
    if (error instanceof GatewayError) {
      return gatewayJson(error.status, {
        error: { message: error.message, type: "invalid_request_error" },
      });
    }
    return gatewayJson(401, { error: { message: "invalid_api_key", type: "invalid_request_error" } });
  }
}
