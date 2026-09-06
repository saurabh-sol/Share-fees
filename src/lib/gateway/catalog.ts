export const LLM_PROVIDERS = ["anthropic", "openai", "deepseek"] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

export type LlmModel = {
  id: string;
  label: string;
  inputPerMillion: number;
  outputPerMillion: number;
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
      { id: "claude-sonnet-5", label: "Claude Sonnet 5", inputPerMillion: 3, outputPerMillion: 15 },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", inputPerMillion: 1, outputPerMillion: 5 },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini", inputPerMillion: 0.15, outputPerMillion: 0.6 },
      { id: "gpt-4o", label: "GPT-4o", inputPerMillion: 2.5, outputPerMillion: 10 },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    models: [
      { id: "deepseek-chat", label: "DeepSeek Chat", inputPerMillion: 0.28, outputPerMillion: 0.42 },
      { id: "deepseek-reasoner", label: "DeepSeek Reasoner", inputPerMillion: 0.55, outputPerMillion: 2.19 },
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

export function findModel(provider: LlmProvider, modelId: string) {
  return modelsForProvider(provider).find((item) => item.id === modelId) ?? null;
}

export function assertProviderModel(provider: string, model: string) {
  if (!isLlmProvider(provider)) {
    throw new Error("invalid_llm_provider");
  }
  const match = findModel(provider, model);
  if (!match) {
    throw new Error("invalid_llm_model");
  }
  return { provider, model, spec: match };
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
