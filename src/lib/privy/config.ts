import type { PrivyClientConfig } from "@privy-io/react-auth";
import { mainnet } from "viem/chains";
import { robinhoodChain } from "@/lib/chains/robinhood";

/**
 * Show ONLY browser-extension wallets detected via EIP-6963.
 * No hardcoded entries — if the wallet isn't installed, it won't appear.
 */
export const PRIVY_INSTALLED_WALLET_LIST = [
  "detected_ethereum_wallets",
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
    termsAndConditionsUrl: "https://accrued.trade/terms",
    privacyPolicyUrl: "https://accrued.trade/privacy",
  },
  mfa: {
    noPromptOnMfaRequired: true,
  },
};
