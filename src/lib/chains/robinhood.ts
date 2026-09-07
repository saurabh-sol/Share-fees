import { defineChain } from "viem";

export const ROBINHOOD_CHAIN_ID = 4663;
export const ROBINHOOD_NOW_NETWORK = "hood";
export const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";

export const ROBINHOOD_USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";

export const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" },
  },
});

export function isRobinhoodChainId(value: number) {
  return value === ROBINHOOD_CHAIN_ID;
}

export function robinhoodExplorerBase(): string {
  return robinhoodChain.blockExplorers.default.url;
}

export function robinhoodTxUrl(txHash: string) {
  return `${robinhoodExplorerBase()}/tx/${txHash}`;
}

export function robinhoodAddressUrl(address: string) {
  return `${robinhoodExplorerBase()}/address/${address}`;
}
