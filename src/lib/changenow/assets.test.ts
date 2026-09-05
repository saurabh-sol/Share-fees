import { describe, expect, it } from "vitest";
import { ROBINHOOD_CHAIN_ID, ROBINHOOD_USDG } from "@/lib/chains/robinhood";
import {
  canMapPair,
  currencyToToken,
  involvesRobinhood,
  isSwapChainId,
  matchCurrency,
  resolveNetwork,
} from "./assets";
import type { ChangeNowCurrency } from "./types";

const currencies: ChangeNowCurrency[] = [
  { ticker: "eth", name: "Ethereum", network: "eth", tokenContract: null },
  { ticker: "eth", name: "Ethereum (Robinhood)", network: "hood", tokenContract: null },
  {
    ticker: "usdg",
    name: "Global Dollar (Robinhood)",
    network: "hood",
    tokenContract: ROBINHOOD_USDG,
    image: "https://changenow.io/images/sprites/currencies/usdg.svg",
  },
  { ticker: "eth", name: "Ethereum", network: "base", tokenContract: null },
  {
    ticker: "usdc",
    name: "USD Coin",
    network: "base",
    tokenContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
];

const NATIVE = "0x0000000000000000000000000000000000000000";

describe("ChangeNOW asset map", () => {
  it("treats 4663 as a swap chain and Robinhood hop", () => {
    expect(isSwapChainId(4663)).toBe(true);
    expect(involvesRobinhood(8453, ROBINHOOD_CHAIN_ID)).toBe(true);
    expect(involvesRobinhood(8453, 42161)).toBe(false);
  });

  it("resolves hood for Robinhood and base for Base", () => {
    expect(resolveNetwork(ROBINHOOD_CHAIN_ID, currencies)).toBe("hood");
    expect(resolveNetwork(8453, currencies)).toBe("base");
  });

  it("maps native ETH on Robinhood and USDG by contract", () => {
    const eth = matchCurrency(currencies, { chainId: ROBINHOOD_CHAIN_ID, tokenAddress: NATIVE });
    expect(eth?.ticker).toBe("eth");
    expect(eth?.network).toBe("hood");
    const usdg = matchCurrency(currencies, {
      chainId: ROBINHOOD_CHAIN_ID,
      tokenAddress: ROBINHOOD_USDG,
    });
    expect(usdg?.ticker).toBe("usdg");
    expect(currencyToToken(usdg!, ROBINHOOD_CHAIN_ID).logoURI).toContain("usdg.svg");
  });

  it("can map Base ETH to Robinhood ETH", () => {
    expect(
      canMapPair(currencies, {
        fromChainId: 8453,
        toChainId: ROBINHOOD_CHAIN_ID,
        fromToken: NATIVE,
        toToken: NATIVE,
      }),
    ).toBe(true);
  });
});
