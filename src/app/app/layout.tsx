import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSession } from "@/lib/auth/session";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { SignOutButton } from "@/components/app/SignOutButton";

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
        <header className="sticky top-0 z-20 border-b border-white/8 bg-[#141416]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 md:px-8">
            <Link href="/app" className="flex items-baseline gap-3">
              <span className="font-mono text-xs tracking-[0.22em] text-[#c23a3a]">T2C</span>
              <span className="text-sm text-zinc-200">Desk</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm text-zinc-400">
              <Link href="/app" className="hover:text-zinc-100">
                Balances
              </Link>
              <Link href="/app/swap" className="hover:text-zinc-100">
                Swap
              </Link>
              <Link href="/app/claims" className="hover:text-zinc-100">
                Claims
              </Link>
              <Link href="/app/redeem" className="hover:text-zinc-100">
                Redeem
              </Link>
              <Link href="/app/rewards" className="hover:text-zinc-100">
                Ledger
              </Link>
              <span className="hidden font-mono text-xs text-zinc-500 md:inline">
                {shortAddress(session.user.address)}
              </span>
              <SignOutButton />
            </nav>
          </div>
        </header>
        <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-8">{children}</div>
      </div>
    </WalletProvider>
  );
}
