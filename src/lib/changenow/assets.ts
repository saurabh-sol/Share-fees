import { formatUnits } from "viem";
import { NATIVE_TOKEN, ROBINHOOD_CHAIN_ID, ROBINHOOD_NOW_NETWORK } from "@/lib/chains/robinhood";
import { ALLOWED_CHAIN_IDS } from "@/lib/lifi/constants";
import type { LifiToken } from "@/lib/lifi/http";
import { ChangeNowError, type ChangeNowCurrency } from "./types";
import { fetchChangeNowCurrencies } from "./http";

export const SWAP_CHAIN_IDS = [...ALLOWED_CHAIN_IDS, ROBINHOOD_CHAIN_ID] as const;
export type SwapChainId = (typeof SWAP_CHAIN_IDS)[number];

const PRIMARY_NETWORK: Record<number, string> = {
  1: "eth",
  10: "op",
  56: "bsc",
  137: "matic",
  42161: "arbitrum",
  8453: "base",
  43114: "avax",
  59144: "linea",
  534352: "scroll",
  81457: "blast",
  [ROBINHOOD_CHAIN_ID]: ROBINHOOD_NOW_NETWORK,
};

const NETWORK_ALIASES: Record<number, string[]> = {
  1: ["eth"],
  10: ["op", "optimism"],
  56: ["bsc"],
  137: ["matic", "maticmainnet", "polygon"],
  42161: ["arbitrum", "arb"],
  8453: ["base"],
  43114: ["avax", "avaxc", "cchain"],
  59144: ["linea"],
  534352: ["scroll"],
  81457: ["blast"],
  [ROBINHOOD_CHAIN_ID]: [ROBINHOOD_NOW_NETWORK, "robinhood"],
};

const NATIVE_TICKERS: Record<number, string[]> = {
  1: ["eth"],
  10: ["eth"],
  56: ["bnb", "bnbmainnet"],
  137: ["matic", "pol"],
  42161: ["eth"],
  8453: ["eth"],
  43114: ["avax"],
  59144: ["eth"],
  534352: ["eth"],
  81457: ["eth"],
  [ROBINHOOD_CHAIN_ID]: ["eth"],
};

export function isSwapChainId(value: number): value is SwapChainId {
  return (SWAP_CHAIN_IDS as readonly number[]).includes(value);
}

export function involvesRobinhood(fromChainId: number, toChainId: number) {
  return fromChainId === ROBINHOOD_CHAIN_ID || toChainId === ROBINHOOD_CHAIN_ID;
}

export function isNativeToken(address: string) {
  return address.trim().toLowerCase() === NATIVE_TOKEN;
}

export function networkCandidates(chainId: number) {
  return NETWORK_ALIASES[chainId] ?? (PRIMARY_NETWORK[chainId] ? [PRIMARY_NETWORK[chainId]] : []);
}

export function resolveNetwork(chainId: number, currencies: ChangeNowCurrency[]) {
  const available = new Set(currencies.map((item) => item.network.toLowerCase()));
  const hit = networkCandidates(chainId).find((network) => available.has(network));
  return hit ?? PRIMARY_NETWORK[chainId] ?? null;
}

export function matchCurrency(
  currencies: ChangeNowCurrency[],
  input: { chainId: number; tokenAddress: string },
): ChangeNowCurrency | null {
  const networks = new Set(networkCandidates(input.chainId));
  const onNetwork = currencies.filter((item) => networks.has(item.network.toLowerCase()));
  if (onNetwork.length === 0) return null;

  if (isNativeToken(input.tokenAddress)) {
    const natives = NATIVE_TICKERS[input.chainId] ?? [];
    return (
      onNetwork.find(
        (item) => natives.includes(item.ticker.toLowerCase()) && !item.tokenContract,
      ) ??
      onNetwork.find((item) => natives.includes(item.ticker.toLowerCase())) ??
      null
    );
  }

  const address = input.tokenAddress.toLowerCase();
  return (
    onNetwork.find((item) => (item.tokenContract ?? "").toLowerCase() === address) ?? null
  );
}

export function currencyToToken(currency: ChangeNowCurrency, chainId: number): LifiToken {
  return {
    address: currency.tokenContract ?? NATIVE_TOKEN,
    symbol: currency.ticker.toUpperCase(),
    name: currency.name,
    decimals: 18,
    chainId,
    logoURI: currency.image ?? undefined,
  };
}

export async function loadMappedPair(input: {
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
}) {
  const currencies = await fetchChangeNowCurrencies();
  const from = matchCurrency(currencies, {
    chainId: input.fromChainId,
    tokenAddress: input.fromToken,
  });
  const to = matchCurrency(currencies, {
    chainId: input.toChainId,
    tokenAddress: input.toToken,
  });
  if (!from || !to) {
    throw new ChangeNowError("That pair is not listed for these networks.", 400);
  }
  return { currencies, from, to };
}

export async function robinhoodTokens(): Promise<LifiToken[]> {
  const currencies = await fetchChangeNowCurrencies();
  const hood = currencies.filter((item) => item.network.toLowerCase() === ROBINHOOD_NOW_NETWORK);
  const featuredTickers = new Set(["eth", "usdg"]);
  const featured = hood.filter((item) => featuredTickers.has(item.ticker.toLowerCase()));
  const rest = hood.filter((item) => !featuredTickers.has(item.ticker.toLowerCase()));
  return [...featured, ...rest].slice(0, 24).map((item) => currencyToToken(item, ROBINHOOD_CHAIN_ID));
}

export function decimalAmount(wei: string, decimals: number) {
  return formatUnits(BigInt(wei), decimals);
}

export function canMapPair(
  currencies: ChangeNowCurrency[],
  input: { fromChainId: number; toChainId: number; fromToken: string; toToken: string },
) {
  return Boolean(
    matchCurrency(currencies, { chainId: input.fromChainId, tokenAddress: input.fromToken }) &&
      matchCurrency(currencies, { chainId: input.toChainId, tokenAddress: input.toToken }),
  );
}
