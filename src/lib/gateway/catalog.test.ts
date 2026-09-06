import { describe, expect, it } from "vitest";
import {
  assertProviderModel,
  estimateUsageCents,
  findModel,
  isLlmProvider,
} from "./catalog";

describe("LLM catalog", () => {
  it("locks each model to one provider", () => {
    expect(isLlmProvider("anthropic")).toBe(true);
    expect(findModel("openai", "gpt-4o-mini")?.id).toBe("gpt-4o-mini");
    expect(findModel("anthropic", "gpt-4o-mini")).toBeNull();
    expect(() => assertProviderModel("deepseek", "deepseek-chat")).not.toThrow();
    expect(() => assertProviderModel("openai", "claude-sonnet-5")).toThrow("invalid_llm_model");
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
    const sonnet = estimateUsageCents({
      provider: "anthropic",
      model: "claude-sonnet-5",
      promptTokens: 200_000,
      completionTokens: 50_000,
    });
    expect(sonnet).toBe(135);
  });
});
