import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { aiGenerations, ledgerEntries } from "@/lib/db/schema";
import { lockWalletRow, sumAccountCents, syncWalletCache } from "@/lib/ledger/balances";
import { LedgerError, newLedgerId } from "@/lib/ledger/post-swap-reward";
import { ACTIVE_JOB_STATUSES, AI_CREATE_HOLD_ACCOUNT } from "./constants";

async function holdBalance(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  holdId: string,
) {
  const rows = await db
    .select({
      total: sql<number>`coalesce(sum(case when ${ledgerEntries.type} = 'credit' then ${ledgerEntries.amountCents} else -${ledgerEntries.amountCents} end), 0)`,
    })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.userId, userId),
        eq(ledgerEntries.account, AI_CREATE_HOLD_ACCOUNT),
        eq(ledgerEntries.referenceId, holdId),
      ),
    );
  return Number(rows[0]?.total ?? 0);
}

export async function reserveAiCredit(
  userId: string,
  holdId: string,
  amountCents: number,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  if (!Number.isInteger(amountCents) || amountCents < 1) {
    throw new LedgerError("invalid_amount");
  }
  const client = db ?? (await getDb());
  return client.transaction(async (tx) => {
    await lockWalletRow(tx as never, userId);
    const createCents = await sumAccountCents(tx as never, userId, "user_ai_create");
    if (createCents < amountCents) {
      throw new LedgerError("insufficient_credits", 402);
    }
    await tx.insert(ledgerEntries).values([
      {
        id: newLedgerId("led"),
        userId,
        account: "user_ai_create",
        type: "debit",
        amountCents,
        referenceType: "ai_create_hold",
        referenceId: holdId,
      },
      {
        id: newLedgerId("led"),
        userId,
        account: AI_CREATE_HOLD_ACCOUNT,
        type: "credit",
        amountCents,
        referenceType: "ai_create_hold",
        referenceId: holdId,
      },
    ]);
    return syncWalletCache(tx as never, userId);
  });
}

export async function settleAiCreditHold(
  userId: string,
  holdId: string,
  actualCents: number,
  jobId: string,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  if (!Number.isInteger(actualCents) || actualCents < 0) {
    throw new LedgerError("invalid_amount");
  }
  const client = db ?? (await getDb());
  return client.transaction(async (tx) => {
    await lockWalletRow(tx as never, userId);
    const heldCents = await holdBalance(tx as never, userId, holdId);
    if (heldCents < 1) {
      throw new LedgerError("hold_not_found", 404);
    }
    const chargedCents = Math.min(actualCents, heldCents);
    const refundCents = heldCents - chargedCents;

    if (chargedCents > 0) {
      await tx.insert(ledgerEntries).values([
        {
          id: newLedgerId("led"),
          userId,
          account: AI_CREATE_HOLD_ACCOUNT,
          type: "debit",
          amountCents: chargedCents,
          referenceType: "ai_create_settle",
          referenceId: jobId,
        },
        {
          id: newLedgerId("led"),
          userId,
          account: "rewards_expense",
          type: "credit",
          amountCents: chargedCents,
          referenceType: "ai_create_settle",
          referenceId: jobId,
        },
      ]);
    }

    if (refundCents > 0) {
      await tx.insert(ledgerEntries).values([
        {
          id: newLedgerId("led"),
          userId,
          account: AI_CREATE_HOLD_ACCOUNT,
          type: "debit",
          amountCents: refundCents,
          referenceType: "ai_create_hold",
          referenceId: holdId,
        },
        {
          id: newLedgerId("led"),
          userId,
          account: "user_ai_create",
          type: "credit",
          amountCents: refundCents,
          referenceType: "ai_create_hold",
          referenceId: holdId,
        },
      ]);
    }

    return { chargedCents, refundCents, ...(await syncWalletCache(tx as never, userId)) };
  });
}

export async function releaseAiCreditHold(
  userId: string,
  holdId: string,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  const client = db ?? (await getDb());
  return client.transaction(async (tx) => {
    await lockWalletRow(tx as never, userId);
    const heldCents = await holdBalance(tx as never, userId, holdId);
    if (heldCents < 1) {
      return { releasedCents: 0, ...(await syncWalletCache(tx as never, userId)) };
    }
    await tx.insert(ledgerEntries).values([
      {
        id: newLedgerId("led"),
        userId,
        account: AI_CREATE_HOLD_ACCOUNT,
        type: "debit",
        amountCents: heldCents,
        referenceType: "ai_create_hold",
        referenceId: holdId,
      },
      {
        id: newLedgerId("led"),
        userId,
        account: "user_ai_create",
        type: "credit",
        amountCents: heldCents,
        referenceType: "ai_create_hold",
        referenceId: holdId,
      },
    ]);
    return { releasedCents: heldCents, ...(await syncWalletCache(tx as never, userId)) };
  });
}

export async function getSpendableAiCreditCents(
  userId: string,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  const client = db ?? (await getDb());
  return sumAccountCents(client, userId, "user_ai_create");
}

export async function countActiveAiJobs(
  userId: string,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  const client = db ?? (await getDb());
  const [row] = await client
    .select({ total: sql<number>`count(*)` })
    .from(aiGenerations)
    .where(
      and(
        eq(aiGenerations.userId, userId),
        sql`${aiGenerations.status} in ('pending', 'processing')`,
      ),
    );
  return Number(row?.total ?? 0);
}
