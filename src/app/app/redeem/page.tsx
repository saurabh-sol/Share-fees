import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { RedeemDesk } from "@/components/app/RedeemDesk";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { wallets } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { getRewardVaultAddress, listOnChainClaims } from "@/lib/redeem/reward-vault";
import { listRedemptions, listVirtualKeys } from "@/lib/redeem/service";

export default async function RedeemPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const db = await getDb();
  const vault = getRewardVaultAddress();
  const [wallet, redemptions, keys, onChainClaims] = await Promise.all([
    db.select().from(wallets).where(eq(wallets.userId, session.user.id)).limit(1).then((rows) => rows[0]),
    listRedemptions(session.user.id, db),
    listVirtualKeys(session.user.id, db),
    session.user.chainNamespace === "solana" || !vault
      ? Promise.resolve([])
      : listOnChainClaims(session.user.address).catch(() => []),
  ]);
  const creditCents = wallet?.creditCacheCents ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">After a claim</p>
        <h1 className="mt-3 text-3xl tracking-tight text-zinc-100">Redeem</h1>
        <p className="mt-3 max-w-[65ch] text-zinc-400">
          Claimed swap credit lands here. Talk to a model on Chat without a key, take USDG as an
          on-chain claim to this wallet, or mint an acc_ key for Cursor. Usage spends your points.
        </p>
      </div>
      <RedeemDesk
        creditCents={creditCents}
        usdtCents={wallet?.usdtCacheCents ?? 0}
        llmCents={wallet?.llmCacheCents ?? 0}
        chainNamespace={session.user.chainNamespace === "solana" ? "solana" : "eip155"}
        gatewayBaseUrl={`${env.publicAppUrl.replace(/\/$/, "")}/v1`}
        initialRedemptions={redemptions}
        initialKeys={keys}
        rewardVaultAddress={vault}
        initialOnChainClaims={onChainClaims}
      />
    </div>
  );
}
