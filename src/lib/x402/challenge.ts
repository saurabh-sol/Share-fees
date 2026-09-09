import {
  PAYMENT_REQUIRED_HEADER,
  challengeResponse,
  encodeBase64Json,
} from "@meshgateway/mpp-server";
import type { PaymentRequirements } from "@meshgateway/mpp-server";
import { buildMerchantConfig } from "./config";
import { quotePaymentRequirements } from "./quote";
import type { LlmProvider } from "@/lib/gateway/catalog";

export function buildPaymentChallenge(input: {
  resourceUrl: string;
  provider: LlmProvider;
  model: string;
  error?: string;
}) {
  const { priceUsdg } = quotePaymentRequirements({
    provider: input.provider,
    model: input.model,
    resourceUrl: input.resourceUrl,
    description: `${input.provider}/${input.model}`,
  });
  const config = buildMerchantConfig(priceUsdg, `${input.provider}/${input.model}`);
  return challengeResponse(config, input.resourceUrl, input.error);
}

export function paymentRequiredBody(requirements: PaymentRequirements, resourceUrl: string, error?: string) {
  return {
    x402Version: 2,
    error: error ?? "Payment is required for this LLM request.",
    accepts: [requirements],
    resource: { url: resourceUrl },
  };
}

export function challengeFromRequirements(
  requirements: PaymentRequirements,
  resourceUrl: string,
  error?: string,
) {
  const body = paymentRequiredBody(requirements, resourceUrl, error);
  return Response.json(body, {
    status: 402,
    headers: {
      [PAYMENT_REQUIRED_HEADER]: encodeBase64Json(body),
      "cache-control": "no-store",
    },
  });
}
