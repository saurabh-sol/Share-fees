import { describe, expect, it } from "vitest";
import {
  assertProviderModel,
  estimateUsageCents,
  findModel,
  gatewayModelSlug,
  isLlmProvider,
} from "./catalog";

describe("LLM catalog", () => {
  it("locks each model to one provider", () => {
    expect(isLlmProvider("anthropic")).toBe(true);
    expect(findModel("openai", "gpt-4o-mini")?.id).toBe("gpt-4o-mini");
    expect(findModel("anthropic", "gpt-4o-mini")).toBeNull();
    expect(() => assertProviderModel("deepseek", "deepseek-chat")).not.toThrow();
    expect(() => assertProviderModel("openai", "claude-sonnet-5")).toThrow("invalid_llm_model");
    expect(gatewayModelSlug("openai", "gpt-4o-mini")).toBe("openai/gpt-4o-mini");
    expect(gatewayModelSlug("anthropic", "claude-haiku-4-5")).toBe("anthropic/claude-haiku-4.5");
    expect(gatewayModelSlug("deepseek", "deepseek-chat")).toBe("deepseek/deepseek-v3.2");
    expect(isLlmProvider("google")).toBe(true);
    expect(findModel("google", "gemini-2.5-flash-lite")?.id).toBe("gemini-2.5-flash-lite");
    expect(findModel("google", "models/gemini-2.5-flash-lite")?.id).toBe("gemini-2.5-flash-lite");
    expect(gatewayModelSlug("google", "gemini-2.5-flash-lite")).toBe(
      "google/gemini-2.5-flash-lite",
    );
    expect(isLlmProvider("grok")).toBe(true);
    expect(findModel("grok", "grok-4.1-fast-non-reasoning")?.id).toBe("grok-4.1-fast-non-reasoning");
    expect(gatewayModelSlug("grok", "grok-4.6")).toBe("xai/grok-4.6");
    expect(isLlmProvider("mistral")).toBe(true);
    expect(findModel("mistral", "mistral-small")?.id).toBe("mistral-small");
    expect(gatewayModelSlug("mistral", "mistral-small")).toBe("mistral/mistral-small");
    expect(isLlmProvider("meta")).toBe(true);
    expect(findModel("meta", "llama-4-scout")?.id).toBe("llama-4-scout");
    expect(isLlmProvider("cohere")).toBe(true);
    expect(findModel("cohere", "command-a")?.id).toBe("command-a");
    expect(isLlmProvider("perplexity")).toBe(true);
    expect(findModel("perplexity", "sonar-pro")?.id).toBe("sonar-pro");
    expect(isLlmProvider("moonshot")).toBe(true);
    expect(findModel("moonshot", "kimi-k2.5")?.id).toBe("kimi-k2.5");
    expect(gatewayModelSlug("moonshot", "kimi-k2.5")).toBe("moonshotai/kimi-k2.5");
  });

  it("meters at least 1 cent and never under-charges a $1 key past the ceil", () => {
    expect(
      estimateUsageCents({
        provider: "openai",
        model: "gpt-4o-mini",
        promptTokens: 100,
        completionTokens: 50,
      }),
    ).toBe(1);
    const gpt4o = estimateUsageCents({
      provider: "openai",
      model: "gpt-4o",
      promptTokens: 200_000,
      completionTokens: 50_000,
    });
    expect(gpt4o).toBe(100);
  });
});
