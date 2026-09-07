import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSession } from "@/lib/auth/session";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { SignOutButton } from "@/components/app/SignOutButton";
import { DeskNavLinks } from "@/components/app/DeskNavLinks";
import { VaultContractLink } from "@/components/onchain/VaultContractLink";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default async function AppShell({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <WalletProvider>
      <div className="min-h-[100dvh]">
        <header className="sticky top-0 z-20 border-b border-white/8 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex min-h-14 max-w-[1400px] items-center justify-between gap-3 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] md:px-8">
            <Link href="/app" className="flex shrink-0 items-baseline gap-3">
              <span className="font-mono text-xs tracking-[0.22em] text-accent">T2C</span>
              <span className="hidden text-sm text-zinc-200 sm:inline">Desk</span>
            </Link>
            <nav className="flex min-w-0 items-center gap-4 overflow-x-auto overscroll-x-contain text-sm text-zinc-400 [-ms-overflow-style:none] [scrollbar-width:none] md:gap-6 [&::-webkit-scrollbar]:hidden">
              <DeskNavLinks
                items={[
                  { href: "/app", label: "Balances", exact: true },
                  { href: "/app/swap", label: "Swap" },
                  { href: "/app/claims", label: "Activity" },
                  { href: "/app/chat", label: "Chat" },
                  { href: "/app/redeem", label: "Redeem" },
                  { href: "/app/rewards", label: "Ledger" },
                ]}
              />
              <span className="hidden font-mono text-xs text-zinc-500 md:inline">
                {shortAddress(session.user.address)}
              </span>
              <SignOutButton />
            </nav>
          </div>
        </header>
        <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-8">{children}</div>
        <footer className="border-t border-white/8">
          <div className="mx-auto flex max-w-[1400px] px-4 py-4 md:px-8">
            <VaultContractLink compact />
          </div>
        </footer>
      </div>
    </WalletProvider>
  );
}
