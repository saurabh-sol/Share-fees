import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { pendingSettles, users } from "@/lib/db/schema";
import { settleChangeNowFill } from "@/lib/changenow/settle";
import { ChangeNowError } from "@/lib/changenow/types";
import { LedgerError, postSwapReward } from "@/lib/ledger/post-swap-reward";
import { SettleError, readVerifiedFill } from "@/lib/lifi/settle";

async function sessionAddressFor(userId: string, db: Awaited<ReturnType<typeof getDb>>) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user?.address ?? null;
}

type LifiSettleFn = (input: {
  txHash: string;
  fromChain?: string;
  toChain?: string;
  sessionAddress: string;
}) => Promise<
  | { kind: "pending"; status: { status: string } }
  | {
      kind: "done";
      executedHash: string;
      fromToken: string;
      toToken: string;
      fromAmount: string;
      toAmount: string;
      notionalUsdCents: number;
    }
>;

export async function processPendingSettles(input?: {
  db?: Awaited<ReturnType<typeof getDb>>;
  limit?: number;
  settleLifi?: LifiSettleFn;
  settleChangeNow?: typeof settleChangeNowFill;
}) {
  const client = input?.db ?? (await getDb());
  const rows = await client
    .select()
    .from(pendingSettles)
    .where(inArray(pendingSettles.status, ["pending", "error"]))
    .limit(input?.limit ?? 20);

  const results: Array<{ id: string; status: string }> = [];

  for (const row of rows) {
    const address = await sessionAddressFor(row.userId, client);
    if (!address) {
      await client
        .update(pendingSettles)
        .set({ status: "error", lastError: "user_missing", attempts: row.attempts + 1, updatedAt: new Date() })
        .where(eq(pendingSettles.id, row.id));
      results.push({ id: row.id, status: "error" });
      continue;
    }

    try {
      if (row.provider === "changenow") {
        if (!row.exchangeId) {
          throw new ChangeNowError("missing_exchange", 400);
        }
        const settleNow = input?.settleChangeNow ?? settleChangeNowFill;
        const verified = await settleNow({
          userId: row.userId,
          sessionAddress: address,
          exchangeId: row.exchangeId,
          txHash: row.txHash,
          fromChain: row.fromChain,
          toChain: row.toChain,
        });
        if (verified.kind === "pending") {
          await client
            .update(pendingSettles)
            .set({ attempts: row.attempts + 1, lastError: verified.status, updatedAt: new Date() })
            .where(eq(pendingSettles.id, row.id));
          results.push({ id: row.id, status: "pending" });
          continue;
        }
        await client
          .update(pendingSettles)
          .set({ status: "done", lastError: null, updatedAt: new Date() })
          .where(eq(pendingSettles.id, row.id));
        results.push({ id: row.id, status: "done" });
        continue;
      }

      const settleLifi = input?.settleLifi ?? readVerifiedFill;
      const verified = await settleLifi({
        txHash: row.txHash,
        fromChain: row.fromChain,
        toChain: row.toChain,
        sessionAddress: address,
      });
      if (verified.kind === "pending") {
        await client
          .update(pendingSettles)
          .set({ attempts: row.attempts + 1, lastError: verified.status.status, updatedAt: new Date() })
          .where(eq(pendingSettles.id, row.id));
        results.push({ id: row.id, status: "pending" });
        continue;
      }

      await postSwapReward(
        {
          userId: row.userId,
          source: "in_app",
          txHash: verified.executedHash.toLowerCase().startsWith("0x")
            ? verified.executedHash.toLowerCase()
            : row.txHash,
          fromChain: row.fromChain,
          toChain: row.toChain,
          fromToken: verified.fromToken,
          toToken: verified.toToken,
          fromAmount: verified.fromAmount,
          toAmount: verified.toAmount,
          notionalUsdCents: verified.notionalUsdCents,
          executedAt: new Date(),
        },
        client,
      );
      await client
        .update(pendingSettles)
        .set({ status: "done", lastError: null, updatedAt: new Date() })
        .where(eq(pendingSettles.id, row.id));
      results.push({ id: row.id, status: "done" });
    } catch (error) {
      if (error instanceof SettleError && error.message.includes("pending")) {
        results.push({ id: row.id, status: "pending" });
        continue;
      }
      const message =
        error instanceof LedgerError || error instanceof ChangeNowError || error instanceof SettleError
          ? error.message
          : error instanceof Error
            ? error.message.slice(0, 180)
            : "settle_failed";
      await client
        .update(pendingSettles)
        .set({
          status: "error",
          lastError: message,
          attempts: row.attempts + 1,
          updatedAt: new Date(),
        })
        .where(eq(pendingSettles.id, row.id));
      results.push({ id: row.id, status: "error" });
    }
  }

  return results;
}
