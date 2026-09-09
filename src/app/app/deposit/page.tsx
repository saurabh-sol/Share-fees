import { redirect } from "next/navigation";
import { DepositDesk } from "@/components/app/DepositDesk";
import { getSession } from "@/lib/auth/session";
import { listDepositHistory } from "@/lib/deposit/service";
import { depositMinUsdCents } from "@/lib/deposit/credit";
import { pageTitle } from "@/lib/brand";

export const metadata = {
  title: pageTitle("Deposit"),
  description: "Deposit $ACCR for LLM credit bonus on Accrued.",
};

export default async function DepositPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const history = await listDepositHistory(session.user.id);

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Accrued v2</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Deposit</h1>
        <p className="mt-3 max-w-[65ch] text-zinc-400">
          Fund your desk with $ACCR. Live DexScreener pricing converts your USD amount to tokens at
          confirm time. After on-chain confirmation, LLM credit bonus is applied to your account.
        </p>
      </div>
      <DepositDesk
        initialHistory={history.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
        }))}
        minUsdCents={depositMinUsdCents()}
      />
    </div>
  );
}
