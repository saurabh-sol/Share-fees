import Link from "next/link";
import type { ReactNode } from "react";
import { AdminSignOut } from "@/components/admin/AdminSignOut";
import { DeskNavLinks } from "@/components/app/DeskNavLinks";
import { getAdminSession } from "@/lib/auth/admin";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getAdminSession();

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-20 border-b border-white/8 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4 md:px-8">
          <Link href="/admin" className="flex items-baseline gap-3">
            <span className="font-mono text-xs tracking-[0.22em] text-accent">T2C</span>
            <span className="text-sm text-zinc-200">Admin</span>
          </Link>
          {admin ? (
            <nav className="flex items-center gap-4 overflow-x-auto text-sm text-zinc-400 md:gap-6">
              <DeskNavLinks
                items={[
                  { href: "/admin", label: "Overview", exact: true },
                  { href: "/admin/rules", label: "Rules" },
                  { href: "/admin/flags", label: "Holds" },
                  { href: "/admin/ledger", label: "Ledger" },
                  { href: "/admin/payouts", label: "Payouts" },
                  { href: "/admin/exchanges", label: "Pay-in routes" },
                ]}
              />
              <AdminSignOut />
            </nav>
          ) : null}
        </div>
      </header>
      <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-8">{children}</div>
    </div>
  );
}
