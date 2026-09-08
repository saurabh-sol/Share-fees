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
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Execution</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Swap studio</h1>
        <p className="mt-3 max-w-[65ch] text-zinc-400">
          Trade tokenized stocks (NVDA, TSLA, AAPL, MSFT, AMZN, GOOGL, META, COIN, SPY, QQQ, SPCX)
          against USDG on Robinhood Chain via Uniswap V4. Every completed swap credits your website
          balance and counts toward your on-platform volume. Below the reward floor the fill still
          happens; the credit is held.
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
