import { describe, expect, it } from "vitest";
import { inferDisplayNotionalCents, stableSymbolNotionalCents } from "./notional-display";

describe("notional-display", () => {
  it("uses stored notional when present", () => {
    expect(
      inferDisplayNotionalCents({
        notionalUsdCents: 25_000,
        fromToken: "NVDA",
        toToken: "USDT",
        fromAmount: "1",
        toAmount: "250",
      }),
    ).toBe(25_000);
  });

  it("infers USD from USDT amount when notional is zero", () => {
    expect(
      inferDisplayNotionalCents({
        notionalUsdCents: 0,
        fromToken: "NVDA",
        toToken: "USDT",
        fromAmount: "0.5",
        toAmount: "125.50",
      }),
    ).toBe(12_550);
  });

  it("infers ETH notional from amount", () => {
    expect(stableSymbolNotionalCents("ETH", "0.1", 300_000)).toBe(30_000);
  });
});
