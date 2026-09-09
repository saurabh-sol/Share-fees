import { describe, expect, it } from "vitest";
import { accrPriceFromPair, pickBestPair } from "./dexscreener";
import { ROBINHOOD_ACCR } from "@/lib/chains/robinhood";

const samplePair = {
  chainId: "robinhood",
  pairAddress: "0xa2d632f7fbdc12b11faa64a0c779f4aa11a5a46e2e21bab3ecb1ec8b73b6e9ed",
  priceUsd: "0.00008996",
  liquidity: { usd: 27696.99 },
  baseToken: { address: ROBINHOOD_ACCR },
  quoteToken: { address: "0x0000000000000000000000000000000000000000" },
};

describe("dexscreener ACCR pricing", () => {
  it("reads price when ACCR is the base token", () => {
    expect(accrPriceFromPair(samplePair, ROBINHOOD_ACCR)).toBeCloseTo(0.00008996, 8);
  });

  it("inverts price when ACCR is the quote token", () => {
    const inverted = {
      ...samplePair,
      priceUsd: "10000",
      baseToken: { address: "0x0000000000000000000000000000000000000000" },
      quoteToken: { address: ROBINHOOD_ACCR },
    };
    expect(accrPriceFromPair(inverted, ROBINHOOD_ACCR)).toBeCloseTo(0.0001, 8);
  });

  it("picks the highest-liquidity robinhood pair", () => {
    const low = { ...samplePair, liquidity: { usd: 100 }, priceUsd: "0.00001" };
    const high = { ...samplePair, liquidity: { usd: 50000 }, priceUsd: "0.00009" };
    const best = pickBestPair([low, high], ROBINHOOD_ACCR);
    expect(best?.priceUsd).toBe("0.00009");
  });
});
