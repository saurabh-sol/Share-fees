import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { PayoutsDesk } from "@/components/admin/PayoutsDesk";
import { getAdminSession } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { payoutOutbox } from "@/lib/db/schema";

export default async function AdminPayoutsPage() {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin");
  const db = await getDb();
  const payouts = await db.select().from(payoutOutbox).orderBy(desc(payoutOutbox.createdAt)).limit(40);

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Treasury</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Payouts</h1>
        <p className="mt-3 max-w-[65ch] text-zinc-400">
          Process only broadcasts when treasury is unlocked. Otherwise the outbox stays queued.
        </p>
      </div>
      <PayoutsDesk initialPayouts={payouts} />
    </div>
  );
}
