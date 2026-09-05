import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  creditEvents,
  fraudFlags,
  ledgerEntries,
  swaps,
  wallets,
} from "@/lib/db/schema";
import { computeRewardCents, getActiveRule } from "@/lib/rules/engine";
import { sumAccountCents } from "./balances";

export type Rail = "usdt" | "llm_credits";

export type PostSwapInput = {
  userId: string;
  source: "in_app" | "historical" | "mock";
  txHash: string;
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  notionalUsdCents: number;
  executedAt: Date;
  rail: Rail;
};

export type PostSwapResult = {
  swapId: string;
  status: string;
  creditedCents: number;
  alreadyExists: boolean;
  usdtCents: number;
  llmCents: number;
};

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export class LedgerError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "LedgerError";
  }
}

export async function postSwapReward(
  input: PostSwapInput,
  db = undefined as Awaited<ReturnType<typeof getDb>> | undefined,
): Promise<PostSwapResult> {
  const client = db ?? (await getDb());
  const rule = await getActiveRule(client);

  if (input.notionalUsdCents < 0 || input.notionalUsdCents > 1_000_000_000) {
    throw new LedgerError("notional_out_of_bounds");
  }

  const existing = await client
    .select()
    .from(swaps)
    .where(and(eq(swaps.txHash, input.txHash), eq(swaps.fromChain, input.fromChain)))
    .limit(1);

  if (existing[0]) {
    const balances = await readWallet(client, input.userId);
    return {
      swapId: existing[0].id,
      status: existing[0].status,
      creditedCents: 0,
      alreadyExists: true,
      ...balances,
    };
  }

  return client.transaction(async (tx) => {
    const swapId = newId("swap");
    const belowFloor = input.notionalUsdCents < rule.minNotionalUsdCents;
    const reward = belowFloor
      ? 0
      : computeRewardCents(input.notionalUsdCents, rule.conversionBps);

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const spentTodayRows = await tx
      .select({
        total: sql<number>`coalesce(sum(${creditEvents.amountCents}), 0)`,
      })
      .from(creditEvents)
      .where(
        and(eq(creditEvents.userId, input.userId), gte(creditEvents.createdAt, startOfDay)),
      );
    const spentToday = Number(spentTodayRows[0]?.total ?? 0);
    const remainingCap = Math.max(0, rule.dailyCapUsdCents - spentToday);
    const credited = Math.min(reward, remainingCap);

    let status = "rewarded";
    if (belowFloor) status = "below_threshold";
    else if (credited === 0) status = "capped";

    await tx.insert(swaps).values({
      id: swapId,
      userId: input.userId,
      source: input.source,
      txHash: input.txHash,
      fromChain: input.fromChain,
      toChain: input.toChain,
      fromToken: input.fromToken,
      toToken: input.toToken,
      fromAmount: input.fromAmount,
      toAmount: input.toAmount,
      notionalUsdCents: input.notionalUsdCents,
      status,
      executedAt: input.executedAt,
    });

    if (credited > 0) {
      const creditId = newId("cred");
      const userAccount = input.rail === "usdt" ? "user_usdt" : "user_llm";

      await tx.insert(creditEvents).values({
        id: creditId,
        userId: input.userId,
        swapId,
        ruleId: rule.id,
        rail: input.rail,
        amountCents: credited,
      });

      await tx.insert(ledgerEntries).values([
        {
          id: newId("led"),
          userId: input.userId,
          account: userAccount,
          type: "credit",
          amountCents: credited,
          referenceType: "swap",
          referenceId: swapId,
        },
        {
          id: newId("led"),
          userId: input.userId,
          account: "rewards_expense",
          type: "debit",
          amountCents: credited,
          referenceType: "swap",
          referenceId: swapId,
        },
      ]);
    } else if (belowFloor || remainingCap === 0) {
      await tx.insert(fraudFlags).values({
        id: newId("flag"),
        userId: input.userId,
        swapId,
        reason: belowFloor ? "below_threshold" : "daily_cap",
        status: "closed",
      });
    }

    const usdtCents = await sumAccountCents(tx as never, input.userId, "user_usdt");
    const llmCents = await sumAccountCents(tx as never, input.userId, "user_llm");

    await tx
      .insert(wallets)
      .values({
        userId: input.userId,
        usdtCacheCents: usdtCents,
        llmCacheCents: llmCents,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: wallets.userId,
        set: {
          usdtCacheCents: usdtCents,
          llmCacheCents: llmCents,
          updatedAt: new Date(),
        },
      });

    return {
      swapId,
      status,
      creditedCents: credited,
      alreadyExists: false,
      usdtCents,
      llmCents,
    };
  });
}

async function readWallet(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
) {
  const [row] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  return {
    usdtCents: row?.usdtCacheCents ?? 0,
    llmCents: row?.llmCacheCents ?? 0,
  };
}
