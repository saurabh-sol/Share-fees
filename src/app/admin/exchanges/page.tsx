import { redirect } from "next/navigation";
import { ExchangesDesk } from "@/components/admin/ExchangesDesk";
import { listChangeNowExchanges } from "@/lib/admin/liability";
import { getAdminSession } from "@/lib/auth/admin";

export default async function AdminExchangesPage() {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin");
  const exchanges = await listChangeNowExchanges();

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Phase 4</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">ChangeNOW</h1>
        <p className="mt-3 max-w-[65ch] text-zinc-400">
          Robinhood Chain ETH and other missing pairs settle here. Credits post only after ChangeNOW marks the
          exchange finished.
        </p>
      </div>
      <ExchangesDesk exchanges={exchanges} />
    </div>
  );
}
