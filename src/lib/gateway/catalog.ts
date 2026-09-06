export const LLM_PROVIDERS = ["anthropic", "openai", "deepseek", "google"] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export type LlmModel = {
  id: string;
  label: string;
  inputPerMillion: number;
  outputPerMillion: number;
  gatewaySlug?: string;
  aliases?: readonly string[];
};

export type LlmProviderCatalog = {
  id: LlmProvider;
  label: string;
  models: readonly LlmModel[];
};

export const LLM_CATALOG: readonly LlmProviderCatalog[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    models: [
      { id: "claude-sonnet-5", label: "Claude Sonnet 5", inputPerMillion: 2.0, outputPerMillion: 10.0, gatewaySlug: "anthropic/claude-sonnet-5" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", inputPerMillion: 1.0, outputPerMillion: 5.0, gatewaySlug: "anthropic/claude-haiku-4.5", aliases: ["claude-haiku-4.5"] },
      { id: "claude-3-haiku", label: "Claude 3 Haiku", inputPerMillion: 0.25, outputPerMillion: 1.25, gatewaySlug: "anthropic/claude-3-haiku" },
      { id: "claude-fable-5", label: "Claude Fable 5", inputPerMillion: 10.0, outputPerMillion: 50.0, gatewaySlug: "anthropic/claude-fable-5" },
      { id: "claude-fable-5.1", label: "Claude Fable 5.1", inputPerMillion: 10.0, outputPerMillion: 50.0, gatewaySlug: "anthropic/claude-fable-5.1" },
      { id: "claude-opus-4", label: "Claude Opus 4", inputPerMillion: 15.0, outputPerMillion: 75.0, gatewaySlug: "anthropic/claude-opus-4" },
      { id: "claude-opus-4.5", label: "Claude Opus 4.5", inputPerMillion: 5.0, outputPerMillion: 25.0, gatewaySlug: "anthropic/claude-opus-4.5" },
      { id: "claude-opus-4.6", label: "Claude Opus 4.6", inputPerMillion: 5.0, outputPerMillion: 25.0, gatewaySlug: "anthropic/claude-opus-4.6" },
      { id: "claude-opus-4.7", label: "Claude Opus 4.7", inputPerMillion: 5.0, outputPerMillion: 25.0, gatewaySlug: "anthropic/claude-opus-4.7" },
      { id: "claude-opus-4.8", label: "Claude Opus 4.8", inputPerMillion: 5.0, outputPerMillion: 25.0, gatewaySlug: "anthropic/claude-opus-4.8" },
      { id: "claude-opus-4.8-fast", label: "Claude Opus 4.8 (Fast)", inputPerMillion: 10.0, outputPerMillion: 50.0, gatewaySlug: "anthropic/claude-opus-4.8-fast" },
      { id: "claude-opus-5", label: "Claude Opus 5", inputPerMillion: 5.0, outputPerMillion: 25.0, gatewaySlug: "anthropic/claude-opus-5" },
      { id: "claude-opus-5-fast", label: "Claude Opus 5 (Fast)", inputPerMillion: 10.0, outputPerMillion: 50.0, gatewaySlug: "anthropic/claude-opus-5-fast" },
      { id: "claude-sonnet-4", label: "Claude Sonnet 4", inputPerMillion: 3.0, outputPerMillion: 15.0, gatewaySlug: "anthropic/claude-sonnet-4" },
      { id: "claude-sonnet-4.5", label: "Claude Sonnet 4.5", inputPerMillion: 3.0, outputPerMillion: 15.0, gatewaySlug: "anthropic/claude-sonnet-4.5" },
      { id: "claude-sonnet-4.6", label: "Claude Sonnet 4.6", inputPerMillion: 3.0, outputPerMillion: 15.0, gatewaySlug: "anthropic/claude-sonnet-4.6" }
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini", inputPerMillion: 0.15, outputPerMillion: 0.6, gatewaySlug: "openai/gpt-4o-mini" },
      { id: "gpt-4o", label: "GPT-4o", inputPerMillion: 2.5, outputPerMillion: 10.0, gatewaySlug: "openai/gpt-4o" },
      { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", inputPerMillion: 0.5, outputPerMillion: 1.5, gatewaySlug: "openai/gpt-3.5-turbo" },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo", inputPerMillion: 10.0, outputPerMillion: 30.0, gatewaySlug: "openai/gpt-4-turbo" },
      { id: "gpt-4.1", label: "GPT-4.1", inputPerMillion: 2.0, outputPerMillion: 8.0, gatewaySlug: "openai/gpt-4.1" },
      { id: "gpt-4.1-fast", label: "GPT-4.1 (Fast)", inputPerMillion: 3.5, outputPerMillion: 14.0, gatewaySlug: "openai/gpt-4.1-fast" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini", inputPerMillion: 0.4, outputPerMillion: 1.6, gatewaySlug: "openai/gpt-4.1-mini" },
      { id: "gpt-4.1-mini-fast", label: "GPT-4.1 mini (Fast)", inputPerMillion: 0.7, outputPerMillion: 2.8, gatewaySlug: "openai/gpt-4.1-mini-fast" },
      { id: "gpt-4.1-nano", label: "GPT-4.1 nano", inputPerMillion: 0.1, outputPerMillion: 0.4, gatewaySlug: "openai/gpt-4.1-nano" },
      { id: "gpt-4.1-nano-fast", label: "GPT-4.1 nano (Fast)", inputPerMillion: 0.2, outputPerMillion: 0.8, gatewaySlug: "openai/gpt-4.1-nano-fast" },
      { id: "gpt-4o-fast", label: "GPT-4o (Fast)", inputPerMillion: 4.25, outputPerMillion: 17.0, gatewaySlug: "openai/gpt-4o-fast" },
      { id: "gpt-4o-mini-fast", label: "GPT-4o mini (Fast)", inputPerMillion: 0.25, outputPerMillion: 1.0, gatewaySlug: "openai/gpt-4o-mini-fast" },
      { id: "gpt-5", label: "GPT-5", inputPerMillion: 1.25, outputPerMillion: 10.0, gatewaySlug: "openai/gpt-5" },
      { id: "gpt-5-fast", label: "GPT-5 (Fast)", inputPerMillion: 2.5, outputPerMillion: 20.0, gatewaySlug: "openai/gpt-5-fast" },
      { id: "gpt-5-codex", label: "GPT-5-Codex", inputPerMillion: 1.25, outputPerMillion: 10.0, gatewaySlug: "openai/gpt-5-codex" },
      { id: "gpt-5-mini", label: "GPT-5 mini", inputPerMillion: 0.25, outputPerMillion: 2.0, gatewaySlug: "openai/gpt-5-mini" },
      { id: "gpt-5-mini-fast", label: "GPT-5 mini (Fast)", inputPerMillion: 0.45, outputPerMillion: 3.6, gatewaySlug: "openai/gpt-5-mini-fast" },
      { id: "gpt-5-nano", label: "GPT-5 nano", inputPerMillion: 0.05, outputPerMillion: 0.4, gatewaySlug: "openai/gpt-5-nano" },
      { id: "gpt-5-pro", label: "GPT-5 pro", inputPerMillion: 15.0, outputPerMillion: 120.0, gatewaySlug: "openai/gpt-5-pro" },
      { id: "gpt-5.1-codex", label: "GPT-5.1-Codex", inputPerMillion: 1.25, outputPerMillion: 10.0, gatewaySlug: "openai/gpt-5.1-codex" },
      { id: "gpt-5.1-codex-max", label: "GPT 5.1 Codex Max", inputPerMillion: 1.25, outputPerMillion: 10.0, gatewaySlug: "openai/gpt-5.1-codex-max" },
      { id: "gpt-5.1-codex-mini", label: "GPT 5.1 Codex Mini", inputPerMillion: 0.25, outputPerMillion: 2.0, gatewaySlug: "openai/gpt-5.1-codex-mini" },
      { id: "gpt-5.1-thinking", label: "GPT 5.1 Thinking", inputPerMillion: 1.25, outputPerMillion: 10.0, gatewaySlug: "openai/gpt-5.1-thinking" },
      { id: "gpt-5.1-thinking-fast", label: "GPT 5.1 Thinking (Fast)", inputPerMillion: 2.5, outputPerMillion: 20.0, gatewaySlug: "openai/gpt-5.1-thinking-fast" },
      { id: "gpt-5.2", label: "GPT 5.2", inputPerMillion: 1.75, outputPerMillion: 14.0, gatewaySlug: "openai/gpt-5.2" },
      { id: "gpt-5.2-fast", label: "GPT 5.2 (Fast)", inputPerMillion: 3.5, outputPerMillion: 28.0, gatewaySlug: "openai/gpt-5.2-fast" },
      { id: "gpt-5.2-codex", label: "GPT 5.2 Codex", inputPerMillion: 1.75, outputPerMillion: 14.0, gatewaySlug: "openai/gpt-5.2-codex" },
      { id: "gpt-5.2-pro", label: "GPT 5.2 Pro", inputPerMillion: 21.0, outputPerMillion: 168.0, gatewaySlug: "openai/gpt-5.2-pro" },
      { id: "gpt-5.3-codex", label: "GPT 5.3 Codex", inputPerMillion: 1.75, outputPerMillion: 14.0, gatewaySlug: "openai/gpt-5.3-codex" },
      { id: "gpt-5.3-codex-fast", label: "GPT 5.3 Codex (Fast)", inputPerMillion: 3.5, outputPerMillion: 28.0, gatewaySlug: "openai/gpt-5.3-codex-fast" },
      { id: "gpt-5.4", label: "GPT 5.4", inputPerMillion: 2.5, outputPerMillion: 15.0, gatewaySlug: "openai/gpt-5.4" },
      { id: "gpt-5.4-fast", label: "GPT 5.4 (Fast)", inputPerMillion: 5.0, outputPerMillion: 30.0, gatewaySlug: "openai/gpt-5.4-fast" },
      { id: "gpt-5.4-mini", label: "GPT 5.4 Mini", inputPerMillion: 0.75, outputPerMillion: 4.5, gatewaySlug: "openai/gpt-5.4-mini" },
      { id: "gpt-5.4-mini-fast", label: "GPT 5.4 Mini (Fast)", inputPerMillion: 1.5, outputPerMillion: 9.0, gatewaySlug: "openai/gpt-5.4-mini-fast" },
      { id: "gpt-5.4-nano", label: "GPT 5.4 Nano", inputPerMillion: 0.2, outputPerMillion: 1.25, gatewaySlug: "openai/gpt-5.4-nano" },
      { id: "gpt-5.4-pro", label: "GPT 5.4 Pro", inputPerMillion: 30.0, outputPerMillion: 180.0, gatewaySlug: "openai/gpt-5.4-pro" },
      { id: "gpt-5.5", label: "GPT 5.5", inputPerMillion: 5.0, outputPerMillion: 30.0, gatewaySlug: "openai/gpt-5.5" },
      { id: "gpt-5.5-fast", label: "GPT 5.5 (Fast)", inputPerMillion: 12.5, outputPerMillion: 75.0, gatewaySlug: "openai/gpt-5.5-fast" },
      { id: "gpt-5.5-pro", label: "GPT 5.5 Pro", inputPerMillion: 30.0, outputPerMillion: 180.0, gatewaySlug: "openai/gpt-5.5-pro" },
      { id: "gpt-5.6-luna", label: "GPT 5.6 Luna", inputPerMillion: 0.2, outputPerMillion: 1.2, gatewaySlug: "openai/gpt-5.6-luna" },
      { id: "gpt-5.6-luna-fast", label: "GPT 5.6 Luna (Fast)", inputPerMillion: 0.4, outputPerMillion: 2.4, gatewaySlug: "openai/gpt-5.6-luna-fast" },
      { id: "gpt-5.6-sol", label: "GPT 5.6 Sol", inputPerMillion: 2.0, outputPerMillion: 10.0, gatewaySlug: "openai/gpt-5.6-sol" },
      { id: "gpt-5.6-sol-fast", label: "GPT 5.6 Sol (Fast)", inputPerMillion: 4.0, outputPerMillion: 20.0, gatewaySlug: "openai/gpt-5.6-sol-fast" },
      { id: "gpt-5.6-terra", label: "GPT 5.6 Terra", inputPerMillion: 2.0, outputPerMillion: 12.0, gatewaySlug: "openai/gpt-5.6-terra" },
      { id: "gpt-5.6-terra-fast", label: "GPT 5.6 Terra (Fast)", inputPerMillion: 4.0, outputPerMillion: 24.0, gatewaySlug: "openai/gpt-5.6-terra-fast" },
      { id: "gpt-6-astra", label: "GPT-6 Astra", inputPerMillion: 10.0, outputPerMillion: 50.0, gatewaySlug: "openai/gpt-6-astra" },
      { id: "gpt-6-astra-fast", label: "GPT-6 Astra (Fast)", inputPerMillion: 20.0, outputPerMillion: 100.0, gatewaySlug: "openai/gpt-6-astra-fast" },
      { id: "gpt-oss-120b", label: "GPT OSS 120B", inputPerMillion: 0.1, outputPerMillion: 0.5, gatewaySlug: "openai/gpt-oss-120b" },
      { id: "gpt-oss-20b", label: "GPT OSS 20B", inputPerMillion: 0.05, outputPerMillion: 0.2, gatewaySlug: "openai/gpt-oss-20b" },
      { id: "gpt-oss-safeguard-120b", label: "GPT OSS Safeguard 120B", inputPerMillion: 0.15, outputPerMillion: 0.6, gatewaySlug: "openai/gpt-oss-safeguard-120b" },
      { id: "gpt-oss-safeguard-20b", label: "GPT OSS Safeguard 20B", inputPerMillion: 0.07, outputPerMillion: 0.2, gatewaySlug: "openai/gpt-oss-safeguard-20b" },
      { id: "o1", label: "o1", inputPerMillion: 15.0, outputPerMillion: 60.0, gatewaySlug: "openai/o1" },
      { id: "o3", label: "o3", inputPerMillion: 2.0, outputPerMillion: 8.0, gatewaySlug: "openai/o3" },
      { id: "o3-fast", label: "o3 (Fast)", inputPerMillion: 3.5, outputPerMillion: 14.0, gatewaySlug: "openai/o3-fast" },
      { id: "o3-mini", label: "o3-mini", inputPerMillion: 1.1, outputPerMillion: 4.4, gatewaySlug: "openai/o3-mini" },
      { id: "o3-pro", label: "o3 Pro", inputPerMillion: 20.0, outputPerMillion: 80.0, gatewaySlug: "openai/o3-pro" },
      { id: "o4-mini", label: "o4-mini", inputPerMillion: 1.1, outputPerMillion: 4.4, gatewaySlug: "openai/o4-mini" },
      { id: "o4-mini-fast", label: "o4-mini (Fast)", inputPerMillion: 2.0, outputPerMillion: 8.0, gatewaySlug: "openai/o4-mini-fast" }
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    models: [
      { id: "deepseek-chat", label: "DeepSeek V3.2", inputPerMillion: 0.28, outputPerMillion: 0.42, gatewaySlug: "deepseek/deepseek-v3.2" },
      { id: "deepseek-reasoner", label: "DeepSeek V3.2 Thinking", inputPerMillion: 0.62, outputPerMillion: 1.85, gatewaySlug: "deepseek/deepseek-v3.2-thinking" },
      { id: "deepseek-r1", label: "DeepSeek-R1", inputPerMillion: 1.35, outputPerMillion: 5.4, gatewaySlug: "deepseek/deepseek-r1" },
      { id: "deepseek-v3.1", label: "DeepSeek V3.1", inputPerMillion: 0.25, outputPerMillion: 0.95, gatewaySlug: "deepseek/deepseek-v3.1" },
      { id: "deepseek-v3.1-terminus", label: "DeepSeek V3.1 Terminus", inputPerMillion: 0.27, outputPerMillion: 1.0, gatewaySlug: "deepseek/deepseek-v3.1-terminus" },
      { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash", inputPerMillion: 0.13, outputPerMillion: 0.26, gatewaySlug: "deepseek/deepseek-v4-flash" },
      { id: "deepseek-v4-flash-0731", label: "DeepSeek V4 Flash 0731", inputPerMillion: 0.076, outputPerMillion: 0.153, gatewaySlug: "deepseek/deepseek-v4-flash-0731" },
      { id: "deepseek-v4-flash-vision-exp", label: "DeepSeek V4 Flash Vision Exp", inputPerMillion: 0.22, outputPerMillion: 0.66, gatewaySlug: "deepseek/deepseek-v4-flash-vision-exp" },
      { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", inputPerMillion: 0.66, outputPerMillion: 1.98, gatewaySlug: "deepseek/deepseek-v4-pro" },
      { id: "deepseek-v4-pro-0813", label: "DeepSeek V4 Pro 0813", inputPerMillion: 0.66, outputPerMillion: 1.98, gatewaySlug: "deepseek/deepseek-v4-pro-0813" }
    ],
  },
  {
    id: "google",
    label: "Google",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", inputPerMillion: 0.3, outputPerMillion: 2.5, gatewaySlug: "google/gemini-2.5-flash" },
      { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", inputPerMillion: 0.1, outputPerMillion: 0.4, gatewaySlug: "google/gemini-2.5-flash-lite" },
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", inputPerMillion: 1.25, outputPerMillion: 10.0, gatewaySlug: "google/gemini-2.5-pro" },
      { id: "gemini-3-flash", label: "Gemini 3 Flash", inputPerMillion: 0.5, outputPerMillion: 3.0, gatewaySlug: "google/gemini-3-flash" },
      { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite", inputPerMillion: 0.25, outputPerMillion: 1.5, gatewaySlug: "google/gemini-3.1-flash-lite" },
      { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview", inputPerMillion: 2.0, outputPerMillion: 12.0, gatewaySlug: "google/gemini-3.1-pro-preview" },
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", inputPerMillion: 1.5, outputPerMillion: 9.0, gatewaySlug: "google/gemini-3.5-flash" },
      { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite", inputPerMillion: 0.3, outputPerMillion: 2.5, gatewaySlug: "google/gemini-3.5-flash-lite" },
      { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash", inputPerMillion: 0.75, outputPerMillion: 3.75, gatewaySlug: "google/gemini-3.6-flash" },
      { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash", inputPerMillion: 0.75, outputPerMillion: 3.75, gatewaySlug: "google/gemini-3.7-flash" },
      { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", inputPerMillion: 0.75, outputPerMillion: 3.75, gatewaySlug: "google/gemini-3.8-flash" },
      { id: "gemma-4-26b-a4b-it", label: "Google Gemma 4 26B A4B", inputPerMillion: 0.15, outputPerMillion: 0.6, gatewaySlug: "google/gemma-4-26b-a4b-it" },
      { id: "gemma-4-31b-it", label: "Gemma 4 31B IT", inputPerMillion: 0.14, outputPerMillion: 0.4, gatewaySlug: "google/gemma-4-31b-it" }
    ],
  },
] as const;

export const DEFAULT_LLM_PROVIDER: LlmProvider = "openai";
export const DEFAULT_LLM_MODEL = "gpt-4o-mini";

export function isLlmProvider(value: string): value is LlmProvider {
  return (LLM_PROVIDERS as readonly string[]).includes(value);
}

export function modelsForProvider(provider: LlmProvider) {
  return LLM_CATALOG.find((item) => item.id === provider)?.models ?? [];
}

export function normalizePublicModel(provider: LlmProvider, modelId: string) {
  let id = modelId.trim();
  if (provider === "google") {
    id = id.replace(/^models\//, "");
    if (id.startsWith("google/")) id = id.slice("google/".length);
  }
  return id;
}

export function findModel(provider: LlmProvider, modelId: string) {
  const id = normalizePublicModel(provider, modelId);
  return (
    modelsForProvider(provider).find(
      (item) => item.id === id || item.id === modelId || item.aliases?.includes(id) || item.aliases?.includes(modelId),
    ) ?? null
  );
}

export function gatewayModelSlug(provider: LlmProvider, model: string) {
  const spec = findModel(provider, model);
  if (spec?.gatewaySlug) return spec.gatewaySlug;
  if (provider === "anthropic" && model === "claude-haiku-4-5") {
    return "anthropic/claude-haiku-4.5";
  }
  return `${provider}/${model}`;
}

export function assertProviderModel(provider: string, model: string) {
  if (!isLlmProvider(provider)) {
    throw new Error("invalid_llm_provider");
  }
  const match = findModel(provider, model);
  if (!match) {
    throw new Error("invalid_llm_model");
  }
  return { provider, model: match.id, spec: match };
}

export function allLlmChoices() {
  return LLM_CATALOG.flatMap((house) =>
    house.models.map((model) => ({
      provider: house.id,
      house: house.label,
      id: model.id,
      label: model.label,
      inputPerMillion: model.inputPerMillion,
      outputPerMillion: model.outputPerMillion,
    })),
  );
}

export function allGatewayModels() {
  return LLM_CATALOG.flatMap((provider) =>
    provider.models.map((model) => ({
      id: model.id,
      object: "model" as const,
      created: 1_704_067_200,
      owned_by: provider.id,
    })),
  );
}

export function estimateUsageCents(input: {
  provider: LlmProvider;
  model: string;
  promptTokens: number;
  completionTokens: number;
}) {
  const spec = findModel(input.provider, input.model) ?? modelsForProvider(input.provider)[0];
  const rate = spec ?? { inputPerMillion: 1, outputPerMillion: 5 };
  const dollars =
    (input.promptTokens * rate.inputPerMillion) / 1_000_000 +
    (input.completionTokens * rate.outputPerMillion) / 1_000_000;
  return Math.max(1, Math.ceil(dollars * 100));
}
