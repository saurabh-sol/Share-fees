import type { PrivyClientConfig } from "@privy-io/react-auth";
import { mainnet } from "viem/chains";
import { robinhoodChain } from "@/lib/chains/robinhood";

/** Installed browser-extension wallets only (EIP-6963). No WalletConnect QR or full catalog. */
export const PRIVY_INSTALLED_WALLET_LIST = [
  "detected_ethereum_wallets",
  "metamask",
  "coinbase_wallet",
  "robinhood_wallet",
] as const;

export const privyConfigBase: PrivyClientConfig = {
  loginMethods: ["wallet"],
  appearance: {
    theme: "dark",
    accentColor: "#c23a3a",
    logo: "/logo.png",
    showWalletLoginFirst: true,
    walletChainType: "ethereum-only",
    walletList: [...PRIVY_INSTALLED_WALLET_LIST],
  },
  embeddedWallets: {
    ethereum: {
      createOnLogin: "off",
    },
  },
  externalWallets: {
    walletConnect: { enabled: false },
  },
  supportedChains: [mainnet, robinhoodChain],
  defaultChain: mainnet,
  legal: {
    termsAndConditionsUrl: undefined,
    privacyPolicyUrl: undefined,
  },
  mfa: {
    noPromptOnMfaRequired: true,
  },
};
