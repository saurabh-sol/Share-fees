import { redirect } from "next/navigation";
import { FlagsDesk } from "@/components/admin/FlagsDesk";
import { listOpenFlags } from "@/lib/admin/liability";
import { getAdminSession } from "@/lib/auth/admin";

export default async function AdminFlagsPage() {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin");
  const flags = await listOpenFlags();

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Fraud</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Holds</h1>
        <p className="mt-3 max-w-[65ch] text-zinc-400">
          Same-wallet A→B→A fills inside 60 minutes do not credit until released.
        </p>
      </div>
      <FlagsDesk initialFlags={flags} />
    </div>
  );
}
