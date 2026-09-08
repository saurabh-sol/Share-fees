import { createConfig, http, injected } from "wagmi";
import { coinbaseWallet, walletConnect } from "wagmi/connectors";
import { mainnet } from "wagmi/chains";
import { robinhoodChain } from "@/lib/chains/robinhood";
import { BRAND_NAME } from "@/lib/brand";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

/**
 * Robinhood Chain is the PRIMARY and DEFAULT chain.
 * Mainnet is kept only so wallets can resolve ENS names.
 * All swaps, claims, and approvals happen on Robinhood Chain (4663).
 */
export const wagmiConfig = createConfig({
  chains: [robinhoodChain, mainnet],
  connectors: [
    injected(),
    coinbaseWallet({
      appName: BRAND_NAME,
      preference: { options: "all" },
    }),
    ...(projectId
      ? [
          walletConnect({
            projectId,
            showQrModal: true,
          }),
        ]
      : []),
  ],
  transports: {
    [robinhoodChain.id]: http("https://rpc.mainnet.chain.robinhood.com"),
    [mainnet.id]: http(),
  },
  ssr: true,
});

export const PRIMARY_WALLET_MATCHERS = [
  {
    id: "metamask",
    label: "MetaMask",
    installUrl: "https://metamask.io/download",
    match: (name: string, rdns?: string | null) =>
      rdns === "io.metamask" || name.toLowerCase().includes("metamask"),
  },
  {
    id: "phantom",
    label: "Phantom",
    installUrl: "https://phantom.app/download",
    match: (name: string, rdns?: string | null) =>
      rdns === "app.phantom" || name.toLowerCase().includes("phantom"),
  },
  {
    id: "coinbase",
    label: "Coinbase Wallet",
    installUrl: "https://www.coinbase.com/wallet/downloads",
    match: (name: string, rdns?: string | null) =>
      rdns === "com.coinbase.wallet" || name.toLowerCase().includes("coinbase"),
  },
] as const;
