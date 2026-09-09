import { getSession } from "@/lib/auth/session";
import { ClaimsBanner } from "@/components/app/ClaimsBanner";
import { ConvertDesk } from "@/components/app/ConvertDesk";
import { HeldBanner } from "@/components/app/HeldBanner";
import { getDb } from "@/lib/db/client";
import { listWalletActivity } from "@/lib/indexer/claim";
import { summarizeWalletVolume } from "@/lib/indexer/summary";
import { syncWalletCache } from "@/lib/ledger/balances";
import { settleScannedVolumeReward } from "@/lib/ledger/volume-reward";
import {
  DEFAULT_CONVERSION_BPS,
  DEFAULT_DAILY_CAP_USD_CENTS,
  MIN_NOTIONAL_USD_CENTS,
  getActiveRuleOrNull,
} from "@/lib/rules/engine";
import { redirect } from "next/navigation";
import Link from "next/link";
import { env } from "@/lib/env";
import { USDG_PAUSE_MESSAGE } from "@/lib/v2/upgrade";

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function DeskPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const db = await getDb();
  const [activity, rule] = await Promise.all([
    listWalletActivity(session.user.id, db),
    getActiveRuleOrNull(db),
  ]);
  const volume = summarizeWalletVolume(activity, {
    conversionBps: rule?.conversionBps,
    minNotionalUsdCents: rule?.minNotionalUsdCents,
  });
  if (volume.qualifiesVolume && volume.estimatedTotalRewardCents > 0) {
    try {
      await settleScannedVolumeReward(session.user.id, db);
    } catch (error) {
      console.error("[desk] volume settle failed", error);
    }
  }
  const wallet = await syncWalletCache(db, session.user.id);

  const creditCents = wallet.creditCents;
  const conversionBps = rule?.conversionBps ?? DEFAULT_CONVERSION_BPS;
  const minNotionalUsdCents = rule?.minNotionalUsdCents ?? MIN_NOTIONAL_USD_CENTS;
  const dailyCapUsdCents = rule?.dailyCapUsdCents ?? DEFAULT_DAILY_CAP_USD_CENTS;

  return (
    <div className="space-y-12">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Balances</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Desk</h1>
      </div>
      <ClaimsBanner userId={session.user.id} />
      <HeldBanner userId={session.user.id} />
      <p className="font-mono text-xs text-zinc-500">
        {conversionBps} bps · {money(minNotionalUsdCents)} floor · $1.00 min credit · {money(dailyCapUsdCents)} daily
        cap
      </p>
      <dl className="grid grid-cols-1 divide-y divide-white/8 border-y border-white/8 md:grid-cols-3 md:divide-x md:divide-y-0">
        <div className="py-8 md:pr-8">
          <dt className="text-sm text-zinc-500">Website credit</dt>
          <dd className="mt-2 font-mono text-4xl tracking-tight text-zinc-100">{money(creditCents)}</dd>
        </div>
        <div className="py-8 md:px-8">
          <dt className="text-sm text-zinc-500">USDG</dt>
          <dd className="mt-2 font-mono text-4xl tracking-tight text-zinc-100">
            {money(wallet.usdtCents)}
          </dd>
        </div>
        <div className="py-8 md:pl-8">
          <dt className="text-sm text-zinc-500">LLM credits</dt>
          <dd className="mt-2 font-mono text-4xl tracking-tight text-zinc-100">
            {money(wallet.llmCents)}
          </dd>
        </div>
      </dl>
      <ConvertDesk
        creditCents={creditCents}
        conversionBps={conversionBps}
        minNotionalUsdCents={minNotionalUsdCents}
        dailyCapUsdCents={dailyCapUsdCents}
        usdgPaused={env.accruedV2Upgrade}
        usdgPauseMessage={USDG_PAUSE_MESSAGE}
      />
      <p className="max-w-[65ch] text-zinc-400">
        Scan finds fills. Claim each qualifying swap to post website credit. Convert to USDG or redeem
        LLM credits before spending — chat and API keys only work after LLM redeem.
      </p>
      <div className="flex flex-wrap gap-6">
        <Link href="/app/swap" className="text-sm text-accent">
          Claim a live fill
        </Link>
        <Link href="/app/claims" className="text-sm text-zinc-300">
          Claim history
        </Link>
        <Link href="/app/chat" className="text-sm text-zinc-300">
          Chat
        </Link>
        <Link href="/app/redeem" className="text-sm text-zinc-300">
          Redeem
        </Link>
      </div>
    </div>
  );
}
