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
          <div className="mx-auto flex min-h-14 max-w-[1400px] items-center justify-between gap-3 px-4 py-2 md:px-8">
            <Link href="/app" className="flex shrink-0 items-baseline gap-3">
              <span className="font-mono text-xs tracking-[0.22em] text-[#c23a3a]">T2C</span>
              <span className="hidden text-sm text-zinc-200 sm:inline">Desk</span>
            </Link>
            <nav className="flex min-w-0 items-center gap-4 overflow-x-auto text-sm text-zinc-400 md:gap-6">
              <Link href="/app" className="shrink-0 hover:text-zinc-100">
                Balances
              </Link>
              <Link href="/app/swap" className="shrink-0 hover:text-zinc-100">
                Swap
              </Link>
              <Link href="/app/claims" className="shrink-0 hover:text-zinc-100">
                Activity
              </Link>
              <Link href="/app/redeem" className="shrink-0 hover:text-zinc-100">
                Redeem
              </Link>
              <Link href="/app/rewards" className="shrink-0 hover:text-zinc-100">
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
