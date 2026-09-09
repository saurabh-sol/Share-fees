import { z } from "zod";
import { LLM_PROVIDERS, type LlmProvider } from "@/lib/gateway/catalog";

export const llmProviderSchema = z.enum(
  LLM_PROVIDERS as unknown as [LlmProvider, ...LlmProvider[]],
);
