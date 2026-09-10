import { defineChain } from "viem";

export const ROBINHOOD_CHAIN_ID = 4663;
export const ROBINHOOD_NOW_NETWORK = "hood";
export const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000";

export const ROBINHOOD_USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
export const ROBINHOOD_USDT = "0xE246BC49b0598d7Cd9f0eAD48B885034f1254380";
export const ROBINHOOD_WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";

/**
 * Tokenized equities and ETFs on Robinhood Chain (verified mainnet addresses).
 * All ERC-20, 18 decimals. Priced against USDG via Uniswap V4 pools.
 * Source: https://docs.robinhood.com/chain/contracts/
 */
export type RobinhoodStock = {
  symbol: string;
  name: string;
  address: string;
  logoURI: string;
};

export const ROBINHOOD_STOCKS: RobinhoodStock[] = [
  { symbol: "NVDA", name: "NVIDIA · Robinhood Token", address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC", logoURI: "https://cdn.robinhood.com/ncw_assets/logos/0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec.png" },
  { symbol: "TSLA", name: "Tesla · Robinhood Token", address: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d", logoURI: "https://cdn.robinhood.com/ncw_assets/logos/0x322f0929c4625ed5bad873c95208d54e1c003b2d.png" },
  { symbol: "AAPL", name: "Apple · Robinhood Token", address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9", logoURI: "https://cdn.robinhood.com/ncw_assets/logos/0xaf3d76f1834a1d425780943c99ea8a608f8a93f9.png" },
  { symbol: "MSFT", name: "Microsoft · Robinhood Token", address: "0xe93237C50D904957Cf27E7B1133b510C669c2e74", logoURI: "https://cdn.robinhood.com/ncw_assets/logos/0xe93237c50d904957cf27e7b1133b510c669c2e74.png" },
  { symbol: "AMZN", name: "Amazon · Robinhood Token", address: "0x12f190a9F9d7D37a250758b26824B97CE941bF54", logoURI: "https://cdn.robinhood.com/ncw_assets/logos/0x12f190a9f9d7d37a250758b26824b97ce941bf54.png" },
  { symbol: "GOOGL", name: "Alphabet Class A · Robinhood Token", address: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3", logoURI: "https://cdn.robinhood.com/ncw_assets/logos/0x2e0847e8910a9732eb3fb1bb4b70a580adad4fe3.png" },
  { symbol: "META", name: "Meta · Robinhood Token", address: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35", logoURI: "https://cdn.robinhood.com/ncw_assets/logos/0xc0d6457c16cc70d6790dd43521c899c87ce02f35.png" },
  { symbol: "COIN", name: "Coinbase · Robinhood Token", address: "0x6330D8C3178a418788dF01a47479c0ce7CCF450b", logoURI: "https://cdn.robinhood.com/ncw_assets/logos/0x6330d8c3178a418788df01a47479c0ce7ccf450b.png" },
  { symbol: "SPY", name: "S&P 500 ETF · Robinhood Token", address: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C", logoURI: "https://cdn.robinhood.com/ncw_assets/logos/0x117cc2133c37b721f49de2a7a74833232b3b4c0c.png" },
  { symbol: "QQQ", name: "Invesco QQQ · Robinhood Token", address: "0xD5f3879160bc7c32ebb4dC785F8a4F505888de68", logoURI: "https://cdn.robinhood.com/ncw_assets/logos/0xd5f3879160bc7c32ebb4dc785f8a4f505888de68.png" },
  { symbol: "SPCX", name: "SpaceX · Robinhood Token", address: "0x4a0E65A3EcceC6dBe60AE065F2e7bb85Fae35eEa", logoURI: "https://cdn.robinhood.com/ncw_assets/logos/0x4a0e65a3eccec6dbe60ae065f2e7bb85fae35eea.png" },
];

/** Deployed UsdgRewardVault on Robinhood Chain. Public; claims and recover go through this address. */
export const USDG_REWARD_VAULT = "0x991FA150A5Cf1680d41137a38bEAa9Eaa0eBE1db";

/** AccruedSwapRouter — emits AccruedSwap for analytics attribution. */
export const ACCRUED_SWAP_ROUTER = "0xc78e883f87675e75334df4d341f6fcb0915ebf19" as const;

/** Public contract address linked in the site navbar. */
export const ROBINHOOD_ACCR = "0x85aCab234fce5d5287a7C24807A317581160420B" as const;
export const SITE_CONTRACT_ADDRESS = ROBINHOOD_ACCR;

/** $ACCR token — holder verification reads balanceOf on Robinhood Chain. */
export const ACCR_TOKEN_ADDRESS = ROBINHOOD_ACCR;

export const ACCR_TOKEN_LOGO =
  "https://robinhoodchain.blockscout.com/token-images/0x85acab234fce5d5287a7c24807a317581160420b.png";

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
  return robinhoodChain.blockExplorers?.default.url ?? "https://robinhoodchain.blockscout.com";
}

export function robinhoodTxUrl(txHash: string) {
  return `${robinhoodExplorerBase()}/tx/${txHash}`;
}

export function robinhoodAddressUrl(address: string) {
  return `${robinhoodExplorerBase()}/address/${address}`;
}
