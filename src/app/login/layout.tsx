import type { Metadata } from "next";
import type { ReactNode } from "react";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { BRAND_NAME, pageTitle } from "@/lib/brand";

export const metadata: Metadata = {
  title: pageTitle("Connect wallet"),
  description: `Connect a wallet to ${BRAND_NAME} with SIWE or SIWS. There is no email account.`,
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}
