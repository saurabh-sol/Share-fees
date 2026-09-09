import { and, eq, gte, sql } from "drizzle-orm";
import { isUniqueViolation } from "@/lib/db/errors";
import { getDb } from "@/lib/db/client";
import {
  creditEvents,
  fraudFlags,
  ledgerEntries,
  swaps,
  wallets,
} from "@/lib/db/schema";
import { env } from "@/lib/env";
import { findWashPrior } from "@/lib/fraud/wash";
import {
  MIN_REWARD_CENTS,
  computeRewardCents,
  getActiveRuleOrNull,
} from "@/lib/rules/engine";
import { lockWalletRow, sumAccountCents, syncWalletCache } from "./balances";
import type { Rail } from "@/lib/redeem/rails";

export type { Rail, StockRail } from "@/lib/redeem/rails";
export { isStockRail, isUsdtLikeRail } from "@/lib/redeem/rails";

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
  rail?: Rail;
  /** Bypass bps math and credit this fixed amount (holder promos). */
  fixedRewardCents?: number;
};

export type PostSwapResult = {
  swapId: string;
  status: string;
  creditedCents: number;
  alreadyExists: boolean;
  creditCents: number;
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
    ruleId: string;
    amountCents: number;
  },
) {
  await tx.insert(creditEvents).values({
    id: newLedgerId("cred"),
    userId: input.userId,
    swapId: input.swapId,
    ruleId: input.ruleId,
    rail: "credits",
    amountCents: input.amountCents,
  });
  await writeRewardLedgerOnly(tx, {
    userId: input.userId,
    swapId: input.swapId,
    amountCents: input.amountCents,
  });
}

export async function writeRewardLedgerOnly(
  tx: {
    insert: Awaited<ReturnType<typeof getDb>>["insert"];
  },
  input: {
    userId: string;
    swapId: string;
    amountCents: number;
  },
) {
  await tx.insert(ledgerEntries).values([
    {
      id: newLedgerId("led"),
      userId: input.userId,
      account: "user_credits",
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

export async function readWallet(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
) {
  const [row] = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  return {
    creditCents: row?.creditCacheCents ?? 0,
    usdtCents: row?.usdtCacheCents ?? 0,
    llmCents: row?.llmCacheCents ?? 0,
  };
}

type RewardDb = Awaited<ReturnType<typeof getDb>>;

export async function postSwapReward(
  input: PostSwapInput,
  db = undefined as RewardDb | undefined,
  extras?: {
    afterWrite?: (tx: RewardDb, result: PostSwapResult) => Promise<void>;
  },
): Promise<PostSwapResult> {
  if (input.source === "mock" && env.nodeEnv === "production") {
    throw new LedgerError("mock_disabled", 403);
  }

  const client = db ?? (await getDb());

  if (input.notionalUsdCents < 0 || input.notionalUsdCents > 1_000_000_000) {
    throw new LedgerError("notional_out_of_bounds");
  }

  try {
    return await client.transaction(async (tx) => {
      await lockWalletRow(tx as never, input.userId);

      const existing = await tx
        .select()
        .from(swaps)
        .where(and(eq(swaps.txHash, input.txHash), eq(swaps.fromChain, input.fromChain)))
        .limit(1);

      if (existing[0]) {
        const balances = await readWallet(tx as never, input.userId);
        const result = {
          swapId: existing[0].id,
          status: existing[0].status,
          creditedCents: 0,
          alreadyExists: true,
          ...balances,
        };
        await extras?.afterWrite?.(tx as never, result);
        return result;
      }

      const swapId = newLedgerId("swap");
      const rule = await getActiveRuleOrNull(tx as never);
      const windowStart = new Date(input.executedAt.getTime() - 60 * 60 * 1000);
      const recents = await tx
        .select()
        .from(swaps)
        .where(and(eq(swaps.userId, input.userId), gte(swaps.executedAt, windowStart)));
      const wash =
        input.fromChain === "scan" || input.fromChain === "holder"
          ? null
          : findWashPrior(input, recents);

      let status = "rewarded";
      let credited = 0;

      if (!rule) {
        status = "paused";
      } else if (input.fixedRewardCents != null) {
        const reward = input.fixedRewardCents;
        if (reward < MIN_REWARD_CENTS) {
          status = "below_threshold";
        } else {
          const remainingCap = await remainingDailyCapCents(
            tx as never,
            input.userId,
            rule.dailyCapUsdCents,
          );
          credited = Math.min(reward, remainingCap);
          if (credited === 0) status = "capped";
        }
      } else if (input.notionalUsdCents < rule.minNotionalUsdCents) {
        status = "below_threshold";
      } else {
        const reward = computeRewardCents(input.notionalUsdCents, rule.conversionBps);
        if (reward < MIN_REWARD_CENTS) {
          status = "below_threshold";
        } else if (wash) {
          status = "held";
        } else {
          const remainingCap = await remainingDailyCapCents(
            tx as never,
            input.userId,
            rule.dailyCapUsdCents,
          );
          credited = Math.min(reward, remainingCap);
          if (credited === 0) status = "capped";
          if (credited > 0 && credited < MIN_REWARD_CENTS) {
            credited = 0;
            status = "below_threshold";
          }
        }
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
          rail: "credits",
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
          rail: "credits",
        });
      }

      const balances = await syncWalletCache(tx as never, input.userId);
      const result = {
        swapId,
        status,
        creditedCents: credited,
        alreadyExists: false,
        ...balances,
      };
      await extras?.afterWrite?.(tx as never, result);
      return result;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const balances = await readWallet(client, input.userId);
      const [row] = await client
        .select()
        .from(swaps)
        .where(and(eq(swaps.txHash, input.txHash), eq(swaps.fromChain, input.fromChain)))
        .limit(1);
      const result = {
        swapId: row?.id ?? "unknown",
        status: row?.status ?? "rewarded",
        creditedCents: 0,
        alreadyExists: true,
        ...balances,
      };
      await extras?.afterWrite?.(client, result);
      return result;
    }
    throw error;
  }
}

export { sumAccountCents };
