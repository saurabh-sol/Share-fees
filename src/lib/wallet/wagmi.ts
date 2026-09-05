import { createConfig, http, injected } from "wagmi";
import { coinbaseWallet, walletConnect } from "wagmi/connectors";
import { arbitrum, base, bsc, mainnet, optimism, polygon, sepolia } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

export const wagmiConfig = createConfig({
  chains: [mainnet, optimism, arbitrum, base, polygon, bsc, sepolia],
  connectors: [
    injected(),
    coinbaseWallet({
      appName: "Trade2Credits",
      preference: "all",
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
    [mainnet.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
    [sepolia.id]: http(),
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
