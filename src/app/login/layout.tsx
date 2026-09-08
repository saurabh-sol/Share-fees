import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PrivyAuthProvider } from "@/components/privy/PrivyAuthProvider";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { BRAND_DESCRIPTION, pageTitle } from "@/lib/brand";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: pageTitle("Connect wallet"),
  description: `${BRAND_DESCRIPTION} Connect with SIWE or SIWS — no email account.`,
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <PrivyAuthProvider appId={env.privyAppId} clientId={env.privyClientId}>
        {children}
      </PrivyAuthProvider>
    </WalletProvider>
  );
}
