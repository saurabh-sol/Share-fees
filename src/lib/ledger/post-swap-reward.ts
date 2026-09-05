import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  creditEvents,
  fraudFlags,
  ledgerEntries,
  swaps,
  wallets,
} from "@/lib/db/schema";
import { findWashPrior } from "@/lib/fraud/wash";
import { computeRewardCents, getActiveRuleOrNull } from "@/lib/rules/engine";
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

export function newLedgerId(prefix: string) {
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

export async function writeRewardLegs(
  tx: {
    insert: Awaited<ReturnType<typeof getDb>>["insert"];
  },
  input: {
    userId: string;
    swapId: string;
    rail: Rail;
    ruleId: string;
    amountCents: number;
  },
) {
  const userAccount = input.rail === "usdt" ? "user_usdt" : "user_llm";
  await tx.insert(creditEvents).values({
    id: newLedgerId("cred"),
    userId: input.userId,
    swapId: input.swapId,
    ruleId: input.ruleId,
    rail: input.rail,
    amountCents: input.amountCents,
  });
  await tx.insert(ledgerEntries).values([
    {
      id: newLedgerId("led"),
      userId: input.userId,
      account: userAccount,
      type: "credit",
      amountCents: input.amountCents,
      referenceType: "swap",
      referenceId: input.swapId,
    },
    {
      id: newLedgerId("led"),
      userId: input.userId,
      account: "rewards_expense",
      type: "debit",
      amountCents: input.amountCents,
      referenceType: "swap",
      referenceId: input.swapId,
    },
  ]);
}

export async function remainingDailyCapCents(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  dailyCapUsdCents: number,
) {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const spentTodayRows = await db
    .select({
      total: sql<number>`coalesce(sum(${creditEvents.amountCents}), 0)`,
    })
    .from(creditEvents)
    .where(and(eq(creditEvents.userId, userId), gte(creditEvents.createdAt, startOfDay)));
  return Math.max(0, dailyCapUsdCents - Number(spentTodayRows[0]?.total ?? 0));
}

export async function postSwapReward(
  input: PostSwapInput,
  db = undefined as Awaited<ReturnType<typeof getDb>> | undefined,
): Promise<PostSwapResult> {
  const client = db ?? (await getDb());

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
    const swapId = newLedgerId("swap");
    const rule = await getActiveRuleOrNull(tx as never);
    const windowStart = new Date(input.executedAt.getTime() - 60 * 60 * 1000);
    const recents = await tx
      .select()
      .from(swaps)
      .where(and(eq(swaps.userId, input.userId), gte(swaps.executedAt, windowStart)));
    const wash = findWashPrior(input, recents);

    let status = "rewarded";
    let credited = 0;

    if (!rule) {
      status = "paused";
    } else if (input.notionalUsdCents < rule.minNotionalUsdCents) {
      status = "below_threshold";
    } else if (wash) {
      status = "held";
    } else {
      const reward = computeRewardCents(input.notionalUsdCents, rule.conversionBps);
      const remainingCap = await remainingDailyCapCents(tx as never, input.userId, rule.dailyCapUsdCents);
      credited = Math.min(reward, remainingCap);
      if (credited === 0) status = "capped";
    }

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

    if (credited > 0 && rule) {
      await writeRewardLegs(tx, {
        userId: input.userId,
        swapId,
        rail: input.rail,
        ruleId: rule.id,
        amountCents: credited,
      });
    } else if (status === "held" && wash) {
      await tx.insert(fraudFlags).values({
        id: newLedgerId("flag"),
        userId: input.userId,
        swapId,
        reason: "wash_round_trip",
        status: "open",
        rail: input.rail,
        detail: JSON.stringify({
          priorFromToken: wash.fromToken,
          priorToToken: wash.toToken,
          priorFromChain: wash.fromChain,
          priorToChain: wash.toChain,
          priorExecutedAt: wash.executedAt.toISOString(),
        }),
      });
    } else if (status === "paused" || status === "below_threshold" || status === "capped") {
      await tx.insert(fraudFlags).values({
        id: newLedgerId("flag"),
        userId: input.userId,
        swapId,
        reason: status === "paused" ? "rewards_paused" : status,
        status: "closed",
        rail: input.rail,
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

export async function readWallet(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
) {
  const [row] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  return {
    usdtCents: row?.usdtCacheCents ?? 0,
    llmCents: row?.llmCacheCents ?? 0,
  };
}
