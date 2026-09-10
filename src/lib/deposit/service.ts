import { and, desc, eq, sql } from "drizzle-orm";
import { formatUnits, parseUnits } from "viem";
import { ROBINHOOD_ACCR } from "@/lib/chains/robinhood";
import { getDb } from "@/lib/db/client";
import { accrDeposits, depositIntents, ledgerEntries, users } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { lockWalletRow, syncWalletCache } from "@/lib/ledger/balances";
import { newLedgerId } from "@/lib/ledger/post-swap-reward";
import {
  computeDisplayCreditCents,
  computeGrantedLlmCents,
  depositMinUsdCents,
} from "./credit";
import { getAccrPriceQuote } from "@/lib/pricing/dexscreener";
import { verifyAccrDepositTx } from "./verify";

export class DepositError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "DepositError";
  }
}

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function parseUsdAmount(raw: string): number {
  const parsed = Number.parseFloat(raw.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new DepositError("invalid_usd_amount");
  }
  return Math.round(parsed * 100);
}

function assertDepositWalletConfigured() {
  if (!env.accrDepositWallet) {
    throw new DepositError("deposit_wallet_unconfigured", 503);
  }
}

function tokenAmountFromUsd(usdCents: number, priceUsd: number) {
  const usd = usdCents / 100;
  const tokens = usd / priceUsd;
  const human = tokens.toFixed(18).replace(/\.?0+$/, "") || "0";
  const raw = parseUnits(human, 18);
  return { human, raw: raw.toString() };
}

export type PrepareDepositResult = {
  intentId: string;
  tokenSymbol: "ACCR";
  logoURI: string;
  priceUsd: string;
  usdCents: number;
  tokenAmountHuman: string;
  tokenAmountRaw: string;
  displayCreditCents: number;
  quoteExpiresAt: string;
};

export async function prepareDeposit(input: {
  userId: string;
  usdAmount: string;
}): Promise<PrepareDepositResult> {
  assertDepositWalletConfigured();

  const usdCents = parseUsdAmount(input.usdAmount);
  const minCents = depositMinUsdCents();
  if (usdCents < minCents) {
    throw new DepositError(`minimum_deposit_${minCents}`);
  }

  const quote = await getAccrPriceQuote({ fresh: true });
  const { human, raw } = tokenAmountFromUsd(usdCents, quote.priceUsd);
  if (BigInt(raw) <= 0n) {
    throw new DepositError("token_amount_too_small");
  }

  const displayCreditCents = computeDisplayCreditCents(usdCents);
  const grantedLlmCents = computeGrantedLlmCents(usdCents);
  const intentId = newId("dep");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  const db = await getDb();
  await db.insert(depositIntents).values({
    id: intentId,
    userId: input.userId,
    usdCents,
    tokenAmountRaw: raw,
    tokenAmountHuman: human,
    priceUsd: quote.priceUsd.toString(),
    displayCreditCents,
    grantedLlmCents,
    dexPairAddress: quote.pairAddress,
    logoUri: quote.logoURI,
    status: "pending",
    expiresAt,
  });

  return {
    intentId,
    tokenSymbol: "ACCR",
    logoURI: quote.logoURI,
    priceUsd: quote.priceUsd.toString(),
    usdCents,
    tokenAmountHuman: human,
    tokenAmountRaw: raw,
    displayCreditCents,
    quoteExpiresAt: expiresAt.toISOString(),
  };
}

export type ExecuteDepositResult = {
  tokenAddress: `0x${string}`;
  recipient: `0x${string}`;
  amountRaw: string;
};

export async function executeDeposit(input: {
  userId: string;
  intentId: string;
}): Promise<ExecuteDepositResult> {
  assertDepositWalletConfigured();

  const db = await getDb();
  const [intent] = await db
    .select()
    .from(depositIntents)
    .where(and(eq(depositIntents.id, input.intentId), eq(depositIntents.userId, input.userId)))
    .limit(1);

  if (!intent) {
    throw new DepositError("intent_not_found", 404);
  }
  if (intent.status !== "pending") {
    throw new DepositError("intent_not_pending", 409);
  }
  if (intent.expiresAt.getTime() < Date.now()) {
    await db
      .update(depositIntents)
      .set({ status: "expired" })
      .where(eq(depositIntents.id, intent.id));
    throw new DepositError("intent_expired", 410);
  }

  return {
    tokenAddress: ROBINHOOD_ACCR as `0x${string}`,
    recipient: env.accrDepositWallet as `0x${string}`,
    amountRaw: intent.tokenAmountRaw,
  };
}

export type ConfirmDepositResult = {
  depositId: string;
  displayCreditCents: number;
  txHash: string;
  llmCents: number;
  alreadyExists: boolean;
};

export async function confirmDeposit(input: {
  userId: string;
  intentId: string;
  txHash: string;
  walletAddress: string;
}): Promise<ConfirmDepositResult> {
  assertDepositWalletConfigured();

  const db = await getDb();
  const [intent] = await db
    .select()
    .from(depositIntents)
    .where(and(eq(depositIntents.id, input.intentId), eq(depositIntents.userId, input.userId)))
    .limit(1);

  if (!intent) {
    throw new DepositError("intent_not_found", 404);
  }

  const [existingByTx] = await db
    .select()
    .from(accrDeposits)
    .where(eq(accrDeposits.txHash, input.txHash))
    .limit(1);
  if (existingByTx) {
    const balances = await syncWalletCache(db, input.userId);
    return {
      depositId: existingByTx.id,
      displayCreditCents: existingByTx.displayCreditCents,
      txHash: input.txHash,
      llmCents: balances.llmCents,
      alreadyExists: true,
    };
  }

  const [existingByIntent] = await db
    .select()
    .from(accrDeposits)
    .where(eq(accrDeposits.intentId, intent.id))
    .limit(1);
  if (existingByIntent?.status === "credited") {
    const balances = await syncWalletCache(db, input.userId);
    return {
      depositId: existingByIntent.id,
      displayCreditCents: existingByIntent.displayCreditCents,
      txHash: existingByIntent.txHash ?? input.txHash,
      llmCents: balances.llmCents,
      alreadyExists: true,
    };
  }

  if (intent.status !== "pending" && intent.status !== "submitted") {
    throw new DepositError("intent_not_pending", 409);
  }

  const verified = await verifyAccrDepositTx({
    txHash: input.txHash,
    expectedFrom: input.walletAddress,
    expectedAmountRaw: BigInt(intent.tokenAmountRaw),
  });

  const depositId = newId("acd");

  return db.transaction(async (tx) => {
    await lockWalletRow(tx as never, input.userId);

    await tx.insert(accrDeposits).values({
      id: depositId,
      userId: input.userId,
      intentId: intent.id,
      txHash: input.txHash,
      tokenAmountRaw: verified.value.toString(),
      usdCentsAtDeposit: intent.usdCents,
      displayCreditCents: intent.displayCreditCents,
      grantedLlmCents: intent.grantedLlmCents,
      priceUsd: intent.priceUsd,
      dexPairAddress: intent.dexPairAddress,
      status: "credited",
    });

    await tx.insert(ledgerEntries).values([
      {
        id: newLedgerId("led"),
        userId: input.userId,
        account: "user_ai_create",
        type: "credit",
        amountCents: intent.grantedLlmCents,
        referenceType: "accr_deposit",
        referenceId: depositId,
      },
      {
        id: newLedgerId("led"),
        userId: input.userId,
        account: "rewards_expense",
        type: "debit",
        amountCents: intent.grantedLlmCents,
        referenceType: "accr_deposit",
        referenceId: depositId,
      },
    ]);

    await tx
      .update(depositIntents)
      .set({ status: "credited" })
      .where(eq(depositIntents.id, intent.id));

    const balances = await syncWalletCache(tx as never, input.userId);

    return {
      depositId,
      displayCreditCents: intent.displayCreditCents,
      txHash: input.txHash,
      llmCents: balances.llmCents,
      alreadyExists: false,
    };
  });
}

export type DepositHistoryRow = {
  id: string;
  usdCents: number;
  tokenAmountHuman: string;
  displayCreditCents: number;
  txHash: string | null;
  status: string;
  createdAt: Date;
};

export async function listDepositHistory(userId: string): Promise<DepositHistoryRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: accrDeposits.id,
      usdCents: accrDeposits.usdCentsAtDeposit,
      tokenAmountRaw: accrDeposits.tokenAmountRaw,
      displayCreditCents: accrDeposits.displayCreditCents,
      txHash: accrDeposits.txHash,
      status: accrDeposits.status,
      createdAt: accrDeposits.createdAt,
    })
    .from(accrDeposits)
    .where(eq(accrDeposits.userId, userId))
    .orderBy(desc(accrDeposits.createdAt))
    .limit(50);

  return rows.map((row) => ({
    id: row.id,
    usdCents: row.usdCents,
    tokenAmountHuman: formatUnits(BigInt(row.tokenAmountRaw), 18),
    displayCreditCents: row.displayCreditCents,
    txHash: row.txHash,
    status: row.status,
    createdAt: row.createdAt,
  }));
}

export type DepositStats = {
  uniqueDepositors: number;
  totalDeposits: number;
  totalAccrRaw: string;
  totalUsdCents: number;
  totalDisplayCreditCents: number;
  lastDepositAt: string | null;
};

export type DepositLeaderboardEntry = {
  address: string;
  depositCount: number;
  totalAccrHuman: string;
  totalUsdCents: number;
  totalDisplayCreditCents: number;
  lastDepositAt: string | null;
};

function sqlInt(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function sqlDateIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

export async function listDepositLeaderboard(
  limit = 100,
  db?: Awaited<ReturnType<typeof getDb>>,
): Promise<DepositLeaderboardEntry[]> {
  const client = db ?? (await getDb());
  const rows = await client
    .select({
      userId: accrDeposits.userId,
      address: users.address,
      depositCount: sql<number>`count(${accrDeposits.id})`,
      totalUsdCents: sql<number>`coalesce(sum(${accrDeposits.usdCentsAtDeposit}), 0)`,
      totalDisplayCreditCents: sql<number>`coalesce(sum(${accrDeposits.displayCreditCents}), 0)`,
      lastDepositAt: sql<Date | null>`max(${accrDeposits.createdAt})`,
    })
    .from(accrDeposits)
    .innerJoin(users, eq(accrDeposits.userId, users.id))
    .where(eq(accrDeposits.status, "credited"))
    .groupBy(accrDeposits.userId, users.address);

  const amounts = await client
    .select({
      userId: accrDeposits.userId,
      tokenAmountRaw: accrDeposits.tokenAmountRaw,
    })
    .from(accrDeposits)
    .where(eq(accrDeposits.status, "credited"));

  const accrByUser = new Map<string, bigint>();
  for (const row of amounts) {
    try {
      accrByUser.set(row.userId, (accrByUser.get(row.userId) ?? 0n) + BigInt(row.tokenAmountRaw));
    } catch {
      /* skip malformed */
    }
  }

  return rows
    .map((row) => ({
      address: row.address,
      depositCount: sqlInt(row.depositCount),
      totalAccrHuman: formatUnits(accrByUser.get(row.userId) ?? 0n, 18),
      totalUsdCents: sqlInt(row.totalUsdCents),
      totalDisplayCreditCents: sqlInt(row.totalDisplayCreditCents),
      lastDepositAt: sqlDateIso(row.lastDepositAt),
    }))
    .sort((a, b) => b.totalUsdCents - a.totalUsdCents)
    .slice(0, limit);
}

export async function getDepositStats(
  db?: Awaited<ReturnType<typeof getDb>>,
): Promise<DepositStats> {
  const client = db ?? (await getDb());
  const [row] = await client
    .select({
      uniqueDepositors: sql<number>`count(distinct ${accrDeposits.userId})`,
      totalDeposits: sql<number>`count(${accrDeposits.id})`,
      totalUsdCents: sql<number>`coalesce(sum(${accrDeposits.usdCentsAtDeposit}), 0)`,
      totalDisplayCreditCents: sql<number>`coalesce(sum(${accrDeposits.displayCreditCents}), 0)`,
      lastDepositAt: sql<Date | null>`max(${accrDeposits.createdAt})`,
    })
    .from(accrDeposits)
    .where(eq(accrDeposits.status, "credited"));

  const amounts = await client
    .select({ tokenAmountRaw: accrDeposits.tokenAmountRaw })
    .from(accrDeposits)
    .where(eq(accrDeposits.status, "credited"));

  let totalAccr = 0n;
  for (const entry of amounts) {
    try {
      totalAccr += BigInt(entry.tokenAmountRaw);
    } catch {
      /* skip malformed */
    }
  }

  return {
    uniqueDepositors: sqlInt(row?.uniqueDepositors),
    totalDeposits: sqlInt(row?.totalDeposits),
    totalAccrRaw: totalAccr.toString(),
    totalUsdCents: sqlInt(row?.totalUsdCents),
    totalDisplayCreditCents: sqlInt(row?.totalDisplayCreditCents),
    lastDepositAt: sqlDateIso(row?.lastDepositAt),
  };
}
