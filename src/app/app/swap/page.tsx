import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { PaperFillForm } from "@/components/app/PaperFillForm";
import { SwapStudio } from "@/components/app/SwapStudio";

export default async function SwapPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-16">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Phase 1</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Swap studio</h1>
        <p className="mt-3 max-w-[65ch] text-zinc-400">
          Routes come from LI.FI. After the wallet signs, we settle against their status API — not your
          typed notional — then write the ledger. Below $500 the fill still happens; the credit is held.
        </p>
      </div>
      <SwapStudio
        sessionAddress={session.user.address}
        chainNamespace={session.user.chainNamespace}
      />
      {env.allowMockSwaps ? (
        <details className="border-t border-white/8 pt-8">
          <summary className="cursor-pointer text-sm text-zinc-500">Paper fill lab</summary>
          <div className="mt-6">
            <PaperFillForm />
          </div>
        </details>
      ) : null}
    </div>
  );
}
