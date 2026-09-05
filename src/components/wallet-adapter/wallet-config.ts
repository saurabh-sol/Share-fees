import type { ComponentType, SVGProps } from "react";
import { MetaMaskLogo } from "./logos/MetaMaskLogo";
import { PhantomLogo } from "./logos/PhantomLogo";
import { CoinbaseLogo } from "./logos/CoinbaseLogo";
import { RobinhoodLogo } from "./logos/RobinhoodLogo";
import { EthereumLogo } from "./logos/EthereumLogo";

export type WalletId =
  | "metamask"
  | "phantom"
  | "coinbase"
  | "robinhood-eth"
  | "walletconnect";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "signing"
  | "connected"
  | "error"
  | "rejected"
  | "unavailable";

export type WalletConfig = {
  id: WalletId;
  name: string;
  description: string;
  type: "wallet" | "network";
  Logo: ComponentType<SVGProps<SVGSVGElement>>;
  installUrl?: string;
  badge?: string;
  rdns?: string;
  nameMatch?: string;
  hidden?: boolean;
};

export type NetworkConfig = {
  id: string;
  name: string;
  chainId: number;
  Logo: ComponentType<SVGProps<SVGSVGElement>>;
  primary?: boolean;
};

export const PRIMARY_WALLETS: WalletConfig[] = [
  {
    id: "metamask",
    name: "MetaMask",
    description: "Connect with MetaMask",
    type: "wallet",
    Logo: MetaMaskLogo,
    installUrl: "https://metamask.io/download",
    rdns: "io.metamask",
    nameMatch: "metamask",
  },
  {
    id: "phantom",
    name: "Phantom",
    description: "Connect with Phantom",
    type: "wallet",
    Logo: PhantomLogo,
    installUrl: "https://phantom.app/download",
    rdns: "app.phantom",
    nameMatch: "phantom",
  },
  {
    id: "coinbase",
    name: "Coinbase",
    description: "Connect with Coinbase",
    type: "wallet",
    Logo: CoinbaseLogo,
    installUrl: "https://www.coinbase.com/wallet/downloads",
    rdns: "com.coinbase.wallet",
    nameMatch: "coinbase",
  },
  {
    id: "robinhood-eth",
    name: "Robinhood ETH",
    description: "Connect with Robinhood (Ethereum)",
    type: "wallet",
    Logo: RobinhoodLogo,
    installUrl: "https://robinhood.com/us/en/support/articles/robinhood-wallet/",
    badge: "NEW",
  },
];

export const EXPANDED_WALLETS: WalletConfig[] = [
  {
    id: "walletconnect",
    name: "WalletConnect",
    description: "Scan with any mobile wallet",
    type: "wallet",
    Logo: EthereumLogo,
    hidden: true,
  },
];

export const PRIMARY_NETWORKS: NetworkConfig[] = [
  { id: "ethereum", name: "Ethereum", chainId: 1, Logo: EthereumLogo, primary: true },
  {
    id: "robinhood-chain",
    name: "Robinhood ETH",
    chainId: 4663,
    Logo: RobinhoodLogo,
    primary: true,
  },
];

export const EXTRA_NETWORKS: NetworkConfig[] = [
  { id: "polygon", name: "Polygon", chainId: 137, Logo: EthereumLogo },
  { id: "arbitrum", name: "Arbitrum", chainId: 42161, Logo: EthereumLogo },
  { id: "optimism", name: "Optimism", chainId: 10, Logo: EthereumLogo },
  { id: "base", name: "Base", chainId: 8453, Logo: EthereumLogo },
];

export const EXPLORE_TILES = [
  { id: "ethereum", label: "Ethereum", Logo: EthereumLogo, action: "network" as const },
  { id: "robinhood-eth", label: "Robinhood ETH", Logo: RobinhoodLogo, action: "network" as const },
  { id: "more-networks", label: "More Networks", Logo: null, action: "networks" as const },
  { id: "view-all", label: "View All", Logo: null, action: "expand" as const },
];
