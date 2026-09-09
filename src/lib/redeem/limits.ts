import { and, desc, eq, gt } from "drizzle-orm";
import type { getDb } from "@/lib/db/client";
import { redemptions } from "@/lib/db/schema";
import { RedeemError } from "./errors";

export const MAX_USDG_REDEEM_CENTS = 100;
export const USDG_REDEEM_COOLDOWN_MS = 30 * 60 * 1000;

export function usdgRedeemErrorMessage(code: string): string {
  switch (code) {
    case "usdg_max_exceeded":
      return "USDG redeems are capped at $1.00 per claim.";
    case "redeem_cooldown_wallet":
      return "Wait 30 minutes before your next USDG claim.";
    case "stock_inventory_insufficient":
      return "Treasury stock inventory is too low for this redeem.";
    default:
      return "Redeem was rejected.";
  }
}

function retryAfterSec(from: Date) {
  return Math.max(1, Math.ceil((from.getTime() + USDG_REDEEM_COOLDOWN_MS - Date.now()) / 1000));
}

export async function assertUsdgRedeemLimits(
  client: Awaited<ReturnType<typeof getDb>>,
  input: { userId: string; amountCents: number },
) {
  if (input.amountCents > MAX_USDG_REDEEM_CENTS) {
    throw new RedeemError("usdg_max_exceeded", 400);
  }

  const cutoff = new Date(Date.now() - USDG_REDEEM_COOLDOWN_MS);

  const [recentWallet] = await client
    .select({ createdAt: redemptions.createdAt })
    .from(redemptions)
    .where(
      and(
        eq(redemptions.userId, input.userId),
        eq(redemptions.rail, "usdt"),
        gt(redemptions.createdAt, cutoff),
      ),
    )
    .orderBy(desc(redemptions.createdAt))
    .limit(1);

  if (recentWallet) {
    throw new RedeemError("redeem_cooldown_wallet", 429, retryAfterSec(recentWallet.createdAt));
  }
}
