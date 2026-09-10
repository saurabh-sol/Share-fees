import { redirect } from "next/navigation";
import { RedeemDesk } from "@/components/app/RedeemDesk";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { env } from "@/lib/env";
import { syncWalletCache } from "@/lib/ledger/balances";
import { getRewardVaultAddress, listOnChainClaims } from "@/lib/redeem/reward-vault";
import { listStockInventory } from "@/lib/redeem/stock-inventory";
import { listRedemptions, listVirtualKeys } from "@/lib/redeem/service";
import { getLlmDisplayCents } from "@/lib/deposit/display";
import { USDG_PAUSE_MESSAGE } from "@/lib/v2/upgrade";

export default async function RedeemPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const db = await getDb();
  const vault = getRewardVaultAddress();
  const evm = session.user.chainNamespace !== "solana";
  const [wallet, displayLlmCents, redemptions, keys, onChainClaims, stocks] = await Promise.all([
    syncWalletCache(db, session.user.id),
    getLlmDisplayCents(session.user.id, db),
    listRedemptions(session.user.id, db),
    listVirtualKeys(session.user.id, db),
    !evm || !vault
      ? Promise.resolve([])
      : listOnChainClaims(session.user.address).catch(() => []),
    evm ? listStockInventory().catch(() => []) : Promise.resolve([]),
  ]);
  const creditCents = wallet.creditCents;

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">After a claim</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Redeem</h1>
        <p className="mt-3 max-w-[65ch] text-zinc-400">
          After you scan and claim qualifying volume, your reward posts as website credit. Choose where
          it goes: Create credits for AI Create (Replicate), LLM credits for chat and acc_ API keys
          (Vercel AI Gateway), or USDG/stock to this wallet.
        </p>
      </div>
      <RedeemDesk
        creditCents={creditCents}
        usdtCents={wallet.usdtCents}
        llmCents={wallet.llmCents}
        aiCreateCents={wallet.aiCreateCents}
        displayLlmCents={displayLlmCents}
        chainNamespace={session.user.chainNamespace === "solana" ? "solana" : "eip155"}
        initialRedemptions={redemptions}
        initialKeys={keys}
        rewardVaultAddress={vault}
        initialOnChainClaims={onChainClaims}
        initialStocks={stocks}
        usdgPaused={env.accruedV2Upgrade}
        usdgPauseMessage={USDG_PAUSE_MESSAGE}
      />
    </div>
  );
}
