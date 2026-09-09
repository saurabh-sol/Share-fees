import { parseUnits } from "viem";
import type { PaymentRequirements } from "@meshgateway/mpp-server";
import { paymentRequirements } from "@meshgateway/mpp-server";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROVIDER,
  assertProviderModel,
  findModel,
  isLlmProvider,
  type LlmProvider,
} from "@/lib/gateway/catalog";
import { buildMerchantConfig, x402DefaultMaxPriceUsdg } from "./config";

const QUOTE_PROMPT_TOKENS = 8192;
const QUOTE_COMPLETION_TOKENS = 4096;

export function estimateWorstCaseCents(provider: LlmProvider, model: string) {
  const spec = findModel(provider, model) ?? findModel(provider, DEFAULT_LLM_MODEL);
  const rate = spec ?? { inputPerMillion: 1, outputPerMillion: 5 };
  const dollars =
    (QUOTE_PROMPT_TOKENS * rate.inputPerMillion) / 1_000_000 +
    (QUOTE_COMPLETION_TOKENS * rate.outputPerMillion) / 1_000_000;
  return Math.max(1, Math.ceil(dollars * 100));
}

export function centsToUsdgString(cents: number) {
  return (cents / 100).toFixed(6).replace(/\.?0+$/, "") || "0.01";
}

export function quoteMaxPriceUsdg(provider: LlmProvider, model: string) {
  const capUsdg = Number(x402DefaultMaxPriceUsdg());
  const worstCents = estimateWorstCaseCents(provider, model);
  const worstUsdg = worstCents / 100;
  const price = Math.min(worstUsdg, capUsdg);
  return price > 0 ? price.toFixed(6).replace(/\.?0+$/, "") || "0.01" : x402DefaultMaxPriceUsdg();
}

export function resolveQuoteModel(providerRaw: unknown, modelRaw: unknown) {
  const provider =
    typeof providerRaw === "string" && isLlmProvider(providerRaw)
      ? providerRaw
      : DEFAULT_LLM_PROVIDER;
  const fallback = findModel(provider, DEFAULT_LLM_MODEL)?.id ?? DEFAULT_LLM_MODEL;
  const model =
    typeof modelRaw === "string" && modelRaw.length > 0 ? modelRaw : fallback;
  try {
    return assertProviderModel(provider, model);
  } catch {
    return assertProviderModel(DEFAULT_LLM_PROVIDER, DEFAULT_LLM_MODEL);
  }
}

export function quotePaymentRequirements(input: {
  provider: LlmProvider;
  model: string;
  resourceUrl: string;
  description?: string;
}): { priceUsdg: string; requirements: PaymentRequirements } {
  const priceUsdg = quoteMaxPriceUsdg(input.provider, input.model);
  const config = buildMerchantConfig(priceUsdg, input.description);
  return {
    priceUsdg,
    requirements: paymentRequirements(config),
  };
}

export function atomicAmountFromUsdg(priceUsdg: string) {
  return parseUnits(priceUsdg, 6).toString();
}
