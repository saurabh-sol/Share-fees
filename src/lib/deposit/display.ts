import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { accrDeposits } from "@/lib/db/schema";
import { syncWalletCache } from "@/lib/ledger/balances";

/**
 * UI-facing LLM balance: deposit bonuses show at 2× (display_credit_cents),
 * while redeem/chat/API still spend the real ledger balance (granted_llm_cents).
 */
export async function getLlmDisplayCents(
  userId: string,
  db?: Awaited<ReturnType<typeof getDb>>,
): Promise<number> {
  const client = db ?? (await getDb());
  const wallet = await syncWalletCache(client, userId);
  const actualLlmCents = wallet.llmCents;

  const [depositTotals] = await client
    .select({
      grantedCents: sql<number>`coalesce(sum(${accrDeposits.grantedLlmCents}), 0)`,
      displayCents: sql<number>`coalesce(sum(${accrDeposits.displayCreditCents}), 0)`,
    })
    .from(accrDeposits)
    .where(and(eq(accrDeposits.userId, userId), eq(accrDeposits.status, "credited")));

  const grantedFromDeposits = Number(depositTotals?.grantedCents ?? 0);
  const displayFromDeposits = Number(depositTotals?.displayCents ?? 0);
  const nonDepositLlmCents = Math.max(0, actualLlmCents - grantedFromDeposits);

  return displayFromDeposits + nonDepositLlmCents;
}

/** UI-facing AI Create balance (includes deposit display multiplier on granted portion). */
export async function getAiCreateDisplayCents(
  userId: string,
  db?: Awaited<ReturnType<typeof getDb>>,
): Promise<number> {
  const client = db ?? (await getDb());
  const wallet = await syncWalletCache(client, userId);
  const actualCreateCents = wallet.aiCreateCents;

  const [depositTotals] = await client
    .select({
      grantedCents: sql<number>`coalesce(sum(${accrDeposits.grantedLlmCents}), 0)`,
      displayCents: sql<number>`coalesce(sum(${accrDeposits.displayCreditCents}), 0)`,
    })
    .from(accrDeposits)
    .where(and(eq(accrDeposits.userId, userId), eq(accrDeposits.status, "credited")));

  const grantedFromDeposits = Number(depositTotals?.grantedCents ?? 0);
  const displayFromDeposits = Number(depositTotals?.displayCents ?? 0);
  const nonDepositCreateCents = Math.max(0, actualCreateCents - grantedFromDeposits);

  return displayFromDeposits + nonDepositCreateCents;
}
