import Link from "next/link";
import type { ReactNode } from "react";
import { AdminSignOut } from "@/components/admin/AdminSignOut";
import { getAdminSession } from "@/lib/auth/admin";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getAdminSession();

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-20 border-b border-white/8 bg-[#141416]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4 md:px-8">
          <Link href="/admin" className="flex items-baseline gap-3">
            <span className="font-mono text-xs tracking-[0.22em] text-[#c23a3a]">T2C</span>
            <span className="text-sm text-zinc-200">Admin</span>
          </Link>
          {admin ? (
            <nav className="flex items-center gap-4 overflow-x-auto text-sm text-zinc-400 md:gap-6">
              <Link href="/admin" className="shrink-0 hover:text-zinc-100">
                Overview
              </Link>
              <Link href="/admin/rules" className="shrink-0 hover:text-zinc-100">
                Rules
              </Link>
              <Link href="/admin/flags" className="shrink-0 hover:text-zinc-100">
                Holds
              </Link>
              <Link href="/admin/ledger" className="shrink-0 hover:text-zinc-100">
                Ledger
              </Link>
              <Link href="/admin/payouts" className="shrink-0 hover:text-zinc-100">
                Payouts
              </Link>
              <Link href="/admin/exchanges" className="shrink-0 hover:text-zinc-100">
                ChangeNOW
              </Link>
              <AdminSignOut />
            </nav>
          ) : null}
        </div>
      </header>
      <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-8">{children}</div>
    </div>
  );
}
