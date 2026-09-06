import { getDb } from "@/lib/db/client";
import { creditConversions, ledgerEntries } from "@/lib/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { lockWalletRow, sumAccountCents, syncWalletCache } from "./balances";
import { LedgerError, newLedgerId } from "./post-swap-reward";

export async function spendableLlmCents(
  userId: string,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  const client = db ?? (await getDb());
  const [creditCents, llmCents, usdtCents] = await Promise.all([
    sumAccountCents(client, userId, "user_credits"),
    sumAccountCents(client, userId, "user_llm"),
    sumAccountCents(client, userId, "user_usdt"),
  ]);
  return {
    creditCents,
    llmCents,
    usdtCents,
    spendableCents: creditCents + llmCents,
  };
}

export async function ensureLlmRail(
  userId: string,
  needCents: number,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  if (!Number.isInteger(needCents) || needCents < 1) {
    throw new LedgerError("invalid_amount");
  }
  const client = db ?? (await getDb());
  return client.transaction(async (tx) => {
    await lockWalletRow(tx as never, userId);
    let llmCents = await sumAccountCents(tx as never, userId, "user_llm");
    const creditCents = await sumAccountCents(tx as never, userId, "user_credits");
    if (llmCents + creditCents < needCents) {
      throw new LedgerError("insufficient_credits", 402);
    }
    let convertedCents = 0;
    if (llmCents < needCents) {
      convertedCents = needCents - llmCents;
      const conversionId = newLedgerId("cnv");
      await tx.insert(creditConversions).values({
        id: conversionId,
        userId,
        rail: "llm_credits",
        amountCents: convertedCents,
        idempotencyKey: `deskchat_${conversionId}`,
      });
      await tx.insert(ledgerEntries).values([
        {
          id: newLedgerId("led"),
          userId,
          account: "user_credits",
          type: "debit",
          amountCents: convertedCents,
          referenceType: "conversion",
          referenceId: conversionId,
        },
        {
          id: newLedgerId("led"),
          userId,
          account: "user_llm",
          type: "credit",
          amountCents: convertedCents,
          referenceType: "conversion",
          referenceId: conversionId,
        },
      ]);
      llmCents += convertedCents;
    }
    const balances = await syncWalletCache(tx as never, userId);
    return { convertedCents, ...balances };
  });
}

const HOLD_ACCOUNT = "desk_chat_hold";
export const DESK_CHAT_MAX_TOKENS = 1024;

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
        eq(ledgerEntries.account, HOLD_ACCOUNT),
        eq(ledgerEntries.referenceId, holdId),
      ),
    );
  return Number(rows[0]?.total ?? 0);
}

export async function holdLlmRail(
  userId: string,
  amountCents: number,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  if (!Number.isInteger(amountCents) || amountCents < 1) {
    throw new LedgerError("invalid_amount");
  }
  const client = db ?? (await getDb());
  await ensureLlmRail(userId, amountCents, client);
  return client.transaction(async (tx) => {
    await lockWalletRow(tx as never, userId);
    const llmCents = await sumAccountCents(tx as never, userId, "user_llm");
    if (llmCents < amountCents) {
      throw new LedgerError("insufficient_credits", 402);
    }
    const holdId = newLedgerId("hld");
    await tx.insert(ledgerEntries).values([
      {
        id: newLedgerId("led"),
        userId,
        account: "user_llm",
        type: "debit",
        amountCents,
        referenceType: "desk_chat_hold",
        referenceId: holdId,
      },
      {
        id: newLedgerId("led"),
        userId,
        account: HOLD_ACCOUNT,
        type: "credit",
        amountCents,
        referenceType: "desk_chat_hold",
        referenceId: holdId,
      },
    ]);
    const balances = await syncWalletCache(tx as never, userId);
    return { holdId, heldCents: amountCents, ...balances };
  });
}

export async function settleLlmHold(
  userId: string,
  holdId: string,
  actualCents: number,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  if (!Number.isInteger(actualCents) || actualCents < 1) {
    throw new LedgerError("invalid_amount");
  }
  const client = db ?? (await getDb());
  return client.transaction(async (tx) => {
    await lockWalletRow(tx as never, userId);
    const heldCents = await holdBalance(tx as never, userId, holdId);
    if (heldCents < 1) {
      throw new LedgerError("insufficient_credits", 402);
    }
    const chargedCents = Math.min(actualCents, heldCents);
    const refundCents = heldCents - chargedCents;
    const spendId = newLedgerId("cht");
    await tx.insert(ledgerEntries).values([
      {
        id: newLedgerId("led"),
        userId,
        account: HOLD_ACCOUNT,
        type: "debit",
        amountCents: chargedCents,
        referenceType: "desk_chat",
        referenceId: spendId,
      },
      {
        id: newLedgerId("led"),
        userId,
        account: "rewards_expense",
        type: "credit",
        amountCents: chargedCents,
        referenceType: "desk_chat",
        referenceId: spendId,
      },
    ]);
    if (refundCents > 0) {
      await tx.insert(ledgerEntries).values([
        {
          id: newLedgerId("led"),
          userId,
          account: HOLD_ACCOUNT,
          type: "debit",
          amountCents: refundCents,
          referenceType: "desk_chat_hold",
          referenceId: holdId,
        },
        {
          id: newLedgerId("led"),
          userId,
          account: "user_llm",
          type: "credit",
          amountCents: refundCents,
          referenceType: "desk_chat_hold",
          referenceId: holdId,
        },
      ]);
    }
    const balances = await syncWalletCache(tx as never, userId);
    return { chargedCents, spendId, ...balances };
  });
}

export async function releaseLlmHold(
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
        account: HOLD_ACCOUNT,
        type: "debit",
        amountCents: heldCents,
        referenceType: "desk_chat_hold",
        referenceId: holdId,
      },
      {
        id: newLedgerId("led"),
        userId,
        account: "user_llm",
        type: "credit",
        amountCents: heldCents,
        referenceType: "desk_chat_hold",
        referenceId: holdId,
      },
    ]);
    const balances = await syncWalletCache(tx as never, userId);
    return { releasedCents: heldCents, ...balances };
  });
}

export async function chargeLlmRail(
  userId: string,
  amountCents: number,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  if (!Number.isInteger(amountCents) || amountCents < 1) {
    throw new LedgerError("invalid_amount");
  }
  const client = db ?? (await getDb());
  return client.transaction(async (tx) => {
    await lockWalletRow(tx as never, userId);
    const llmCents = await sumAccountCents(tx as never, userId, "user_llm");
    const chargedCents = Math.min(amountCents, llmCents);
    if (chargedCents < 1) {
      throw new LedgerError("insufficient_credits", 402);
    }
    const spendId = newLedgerId("cht");
    await tx.insert(ledgerEntries).values([
      {
        id: newLedgerId("led"),
        userId,
        account: "user_llm",
        type: "debit",
        amountCents: chargedCents,
        referenceType: "desk_chat",
        referenceId: spendId,
      },
      {
        id: newLedgerId("led"),
        userId,
        account: "rewards_expense",
        type: "credit",
        amountCents: chargedCents,
        referenceType: "desk_chat",
        referenceId: spendId,
      },
    ]);
    const balances = await syncWalletCache(tx as never, userId);
    return { chargedCents, spendId, ...balances };
  });
}
