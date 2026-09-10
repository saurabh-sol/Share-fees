import { and, eq, lte, or } from "drizzle-orm";
import { createPublicClient, http } from "viem";
import { robinhoodChain } from "@/lib/chains/robinhood";
import { getDb } from "@/lib/db/client";
import { ledgerEntries, payoutOutbox, redemptions } from "@/lib/db/schema";
import { syncWalletCache } from "@/lib/ledger/balances";
import { newLedgerId } from "@/lib/ledger/post-swap-reward";
import { isStockRail } from "@/lib/ledger/post-swap-reward";
import { isRedemptionClaimedOnChain } from "@/lib/redeem/reward-vault";
import { broadcastStockPayout, stockTreasuryCanBroadcast } from "@/lib/redeem/stock-payout";
import { broadcastRobinhoodUsdg, treasuryCanPayOnChain, type BroadcastUsdt } from "@/lib/redeem/treasury";
import { env } from "@/lib/env";
import { isAccruedV2Upgrade } from "@/lib/v2/upgrade";

const MAX_ATTEMPTS = 8;
const STALE_MS = 5 * 60 * 1000;

function backoffMs(attempts: number) {
  return Math.min(60 * 60 * 1000, 30_000 * 2 ** Math.max(0, attempts - 1));
}

async function confirmReceipt(txHash: string) {
  const client = createPublicClient({ chain: robinhoodChain, transport: http() });
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash as `0x${string}`,
    timeout: 90_000,
  });
  if (receipt.status !== "success") {
    throw new Error("tx_reverted");
  }
}

async function refundPayout(
  db: Awaited<ReturnType<typeof getDb>>,
  row: typeof payoutOutbox.$inferSelect,
) {
  await db.insert(ledgerEntries).values([
    {
      id: newLedgerId("led"),
      userId: row.userId,
      account: "user_usdt",
      type: "credit",
      amountCents: row.amountCents,
      referenceType: "payout_refund",
      referenceId: row.id,
    },
    {
      id: newLedgerId("led"),
      userId: row.userId,
      account: "payout_pool",
      type: "debit",
      amountCents: row.amountCents,
      referenceType: "payout_refund",
      referenceId: row.id,
    },
  ]);
  await db
    .update(redemptions)
    .set({ status: "refunded" })
    .where(eq(redemptions.id, row.redemptionId));
  await syncWalletCache(db, row.userId);
}

export async function processPayoutOutbox(input?: {
  broadcast?: BroadcastUsdt;
  confirm?: (txHash: string) => Promise<void>;
  db?: Awaited<ReturnType<typeof getDb>>;
}) {
  const client = input?.db ?? (await getDb());
  const send = input?.broadcast ?? broadcastRobinhoodUsdg;
  const waitReceipt = input?.confirm ?? (input?.broadcast ? async () => undefined : confirmReceipt);
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_MS);

  const due = or(
    and(eq(payoutOutbox.status, "queued"), lte(payoutOutbox.availableAt, now)),
    and(eq(payoutOutbox.status, "sending"), lte(payoutOutbox.updatedAt, staleBefore)),
  );

  const results: Array<{ id: string; status: string; txHash?: string }> = [];

  const canPayUsdg = treasuryCanPayOnChain() || Boolean(input?.broadcast);
  const canPayStock = stockTreasuryCanBroadcast() || Boolean(input?.broadcast);

  for (;;) {
    if (!canPayUsdg && !canPayStock && !input?.broadcast) {
      const idle = await client.select().from(payoutOutbox).where(due);
      for (const row of idle) results.push({ id: row.id, status: "queued" });
      break;
    }

    const claimed = await client.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(payoutOutbox)
        .where(due)
        .limit(1)
        .for("update", { skipLocked: true });
      if (!row) return null;
      const [updated] = await tx
        .update(payoutOutbox)
        .set({
          status: "sending",
          attempts: row.attempts + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(payoutOutbox.id, row.id),
            or(eq(payoutOutbox.status, "queued"), eq(payoutOutbox.status, "sending")),
          ),
        )
        .returning();
      return updated ?? null;
    });
    if (!claimed) break;
    const row = claimed;

    try {
      const [redemption] = await client
        .select({ rail: redemptions.rail })
        .from(redemptions)
        .where(eq(redemptions.id, row.redemptionId))
        .limit(1);
      const rail = redemption?.rail ?? "usdt";
      const stockPayout = isStockRail(rail);

      if (stockPayout && !env.stockRedeemEnabled) {
        await client
          .update(payoutOutbox)
          .set({ status: "queued", updatedAt: new Date() })
          .where(eq(payoutOutbox.id, row.id));
        results.push({ id: row.id, status: "queued_stock_paused" });
        continue;
      }
      if (stockPayout && !canPayStock && !input?.broadcast) {
        await client
          .update(payoutOutbox)
          .set({ status: "queued", updatedAt: new Date() })
          .where(eq(payoutOutbox.id, row.id));
        results.push({ id: row.id, status: "queued" });
        continue;
      }
      if (!stockPayout && isAccruedV2Upgrade()) {
        await client
          .update(payoutOutbox)
          .set({ status: "queued", updatedAt: new Date() })
          .where(eq(payoutOutbox.id, row.id));
        results.push({ id: row.id, status: "queued_paused" });
        continue;
      }

      if (!stockPayout && !canPayUsdg && !input?.broadcast) {
        await client
          .update(payoutOutbox)
          .set({ status: "queued", updatedAt: new Date() })
          .where(eq(payoutOutbox.id, row.id));
        results.push({ id: row.id, status: "queued" });
        continue;
      }

      if (
        !stockPayout &&
        !input?.broadcast &&
        (await isRedemptionClaimedOnChain(row.redemptionId))
      ) {
        await client
          .update(payoutOutbox)
          .set({
            status: "sent",
            txHash: row.txHash,
            lastError: null,
            updatedAt: new Date(),
          })
          .where(eq(payoutOutbox.id, row.id));
        await client
          .update(redemptions)
          .set({ status: "fulfilled", fulfilledAt: new Date() })
          .where(eq(redemptions.id, row.redemptionId));
        results.push({ id: row.id, status: "sent", txHash: row.txHash ?? undefined });
        continue;
      }

      const txHash = stockPayout
        ? await broadcastStockPayout({
            rail,
            destination: row.destination,
            amountCents: row.amountCents,
            redemptionId: row.redemptionId,
          })
        : await send({
            destination: row.destination,
            amountCents: row.amountCents,
            redemptionId: row.redemptionId,
          });
      await waitReceipt(txHash);
      await client
        .update(payoutOutbox)
        .set({ status: "sent", txHash, lastError: null, updatedAt: new Date() })
        .where(eq(payoutOutbox.id, row.id));
      await client
        .update(redemptions)
        .set({ status: "fulfilled", fulfilledAt: new Date() })
        .where(eq(redemptions.id, row.redemptionId));
      results.push({ id: row.id, status: "sent", txHash });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 180) : "payout_failed";
      const attempts = row.attempts;
      if (attempts >= MAX_ATTEMPTS) {
        await client
          .update(payoutOutbox)
          .set({ status: "failed", lastError: message, updatedAt: new Date() })
          .where(eq(payoutOutbox.id, row.id));
        await refundPayout(client, row);
        results.push({ id: row.id, status: "failed" });
      } else {
        await client
          .update(payoutOutbox)
          .set({
            status: "queued",
            lastError: message,
            availableAt: new Date(Date.now() + backoffMs(attempts)),
            updatedAt: new Date(),
          })
          .where(eq(payoutOutbox.id, row.id));
        results.push({ id: row.id, status: "queued" });
      }
    }
  }

  return results;
}
