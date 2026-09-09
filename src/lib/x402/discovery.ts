import { allGatewayModels, LLM_CATALOG, type LlmProvider } from "@/lib/gateway/catalog";
import { toOpenAiModel } from "@/lib/gateway/openai";
import { env } from "@/lib/env";
import { isX402Enabled, x402OfferMeta } from "./config";
import { quoteMaxPriceUsdg } from "./quote";

const PAYWALLED_ROUTES = [
  { method: "POST", path: "/v1/chat/completions", description: "OpenAI-compatible chat completions" },
  { method: "POST", path: "/v1/messages", description: "Anthropic messages API" },
  { method: "POST", path: "/v1beta/models/{model}:generateContent", description: "Google Gemini native API" },
] as const;

export function x402DiscoveryDocument() {
  const origin = env.publicAppUrl.replace(/\/$/, "");
  const models = allGatewayModels().map((item) => {
    const provider = item.owned_by as LlmProvider;
    const maxPriceUsdg = quoteMaxPriceUsdg(provider, item.id);
    return {
      id: item.id,
      provider,
      maxPriceUsdg,
      x402: x402OfferMeta(maxPriceUsdg),
    };
  });

  return {
    x402Version: 2,
    name: "Accrued LLM Gateway",
    origin,
    enabled: isX402Enabled(),
    routes: PAYWALLED_ROUTES.map((route) => ({
      ...route,
      url: `${origin}${route.path}`,
    })),
    payment: x402OfferMeta(quoteMaxPriceUsdg("openai", "gpt-4o-mini")),
    models,
    providers: LLM_CATALOG.map((house) => ({
      id: house.id,
      label: house.label,
      models: house.models.map((model) => ({
        id: model.id,
        maxPriceUsdg: quoteMaxPriceUsdg(house.id, model.id),
      })),
    })),
  };
}

export function x402ModelsList() {
  return {
    object: "list" as const,
    data: allGatewayModels().map((item) => {
      const provider = item.owned_by as LlmProvider;
      const maxPriceUsdg = quoteMaxPriceUsdg(provider, item.id);
      return {
        ...toOpenAiModel(item.id, provider),
        x402: x402OfferMeta(maxPriceUsdg),
      };
    }),
  };
}

export function x402OpenApiExtension() {
  const doc = x402DiscoveryDocument();
  return {
    openapi: "3.1.0",
    info: {
      title: "Accrued LLM x402 Discovery",
      version: "1.0.0",
      description: "Machine-readable x402 pricing for Accrued LLM gateway routes.",
    },
    servers: [{ url: doc.origin }],
    paths: Object.fromEntries(
      doc.routes.map((route) => [
        route.path,
        {
          [route.method.toLowerCase()]: {
            summary: route.description,
            "x-x402": {
              enabled: doc.enabled,
              ...doc.payment,
            },
            responses: {
              "402": { description: "Payment required — x402 offer in payment-required header" },
              "200": { description: "Successful inference" },
            },
          },
        },
      ]),
    ),
    "x-x402-models": doc.models,
  };
}
