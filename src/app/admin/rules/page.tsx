import { desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { RulesForm } from "@/components/admin/RulesForm";
import { getAdminSession } from "@/lib/auth/admin";
import { getDb } from "@/lib/db/client";
import { rewardRules } from "@/lib/db/schema";

export default async function AdminRulesPage() {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin");

  const db = await getDb();
  const rules = await db.select().from(rewardRules).orderBy(desc(rewardRules.version));

  return (
    <div className="space-y-10">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Rules console</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Reward rules</h1>
      </div>
      <RulesForm latest={rules[0] ?? null} />
      <ul className="divide-y divide-white/8 border-y border-white/8">
        {rules.map((rule) => (
          <li key={rule.id} className="flex items-center justify-between py-4">
            <p className="font-mono text-sm text-zinc-100">
              v{rule.version} · {rule.conversionBps} bps
            </p>
            <p className="font-mono text-xs text-zinc-500">{rule.enabled ? "on" : "off"}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
