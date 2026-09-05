import type { ReactNode } from "react";
import { WalletProvider } from "@/components/wallet/WalletProvider";

export default function LoginLayout({ children }: { children: ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}
