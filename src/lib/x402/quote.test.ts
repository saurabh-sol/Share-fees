import { describe, expect, it, afterEach } from "vitest";
import { quoteMaxPriceUsdg, estimateWorstCaseCents, centsToUsdgString } from "./quote";

describe("x402 quote", () => {
  const previous = process.env.X402_DEFAULT_MAX_PRICE_USDG;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.X402_DEFAULT_MAX_PRICE_USDG;
    } else {
      process.env.X402_DEFAULT_MAX_PRICE_USDG = previous;
    }
  });

  it("caps model worst-case quote by X402_DEFAULT_MAX_PRICE_USDG", () => {
    process.env.X402_DEFAULT_MAX_PRICE_USDG = "0.05";
    const uncapped = estimateWorstCaseCents("openai", "gpt-4o");
    expect(uncapped).toBeGreaterThan(5);
    expect(quoteMaxPriceUsdg("openai", "gpt-4o")).toBe("0.05");
  });

  it("uses model estimate when below cap", () => {
    process.env.X402_DEFAULT_MAX_PRICE_USDG = "1";
    const quote = quoteMaxPriceUsdg("openai", "gpt-4o-mini");
    expect(Number(quote)).toBeLessThan(1);
    expect(Number(quote)).toBeGreaterThan(0);
  });

  it("converts cents to USDG strings", () => {
    expect(centsToUsdgString(100)).toBe("1");
    expect(centsToUsdgString(1)).toBe("0.01");
  });
});
