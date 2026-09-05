import { eq } from "drizzle-orm";
import { addressesEqual } from "@/lib/lifi/notional";
import { getDb } from "@/lib/db/client";
import { changenowExchanges } from "@/lib/db/schema";
import { LedgerError, postSwapReward, type Rail } from "@/lib/ledger/post-swap-reward";
import { ChangeNowError, type ChangeNowExchange } from "./types";
import { fetchChangeNowExchange } from "./http";
import { loadUserExchange } from "./create";

const PENDING = new Set(["new", "waiting", "confirming", "exchanging", "sending", "verifying"]);
const FAILED = new Set(["failed", "refunded", "expired"]);

export function classifyChangeNowStatus(status: string) {
  const value = status.trim().toLowerCase();
  if (value === "finished") return "done" as const;
  if (FAILED.has(value)) return "failed" as const;
  if (PENDING.has(value) || !value) return "pending" as const;
  return "pending" as const;
}

export function assertPayoutOwnedBy(exchange: ChangeNowExchange, sessionAddress: string) {
  if (!exchange.payoutAddress) {
    throw new ChangeNowError("missing_payout_address", 422);
  }
  if (!addressesEqual(exchange.payoutAddress, sessionAddress)) {
    throw new ChangeNowError("payout_address_mismatch", 403);
  }
}

export async function settleChangeNowFill(input: {
  userId: string;
  sessionAddress: string;
  exchangeId: string;
  txHash: string;
  fromChain: string;
  toChain: string;
  rail: Rail;
}) {
  const stored = await loadUserExchange({ userId: input.userId, exchangeId: input.exchangeId });
  const live = await fetchChangeNowExchange(input.exchangeId);
  const kind = classifyChangeNowStatus(live.status);

  const db = await getDb();
  await db
    .update(changenowExchanges)
    .set({
      status: live.status,
      depositTx: live.payinHash ?? input.txHash,
      payoutTx: live.payoutHash,
      toAmount: live.toAmount || stored.toAmount,
      updatedAt: new Date(),
    })
    .where(eq(changenowExchanges.id, stored.id));

  if (kind === "pending") {
    return { kind: "pending" as const, status: live.status };
  }
  if (kind === "failed") {
    throw new ChangeNowError(`ChangeNOW marked the swap ${live.status}.`, 400);
  }

  assertPayoutOwnedBy(live, input.sessionAddress);
  if (stored.notionalUsdCents <= 0) {
    throw new ChangeNowError("missing_usd_notional", 422);
  }

  const executedHash = (live.payinHash ?? input.txHash).toLowerCase();
  try {
    const result = await postSwapReward({
      userId: input.userId,
      source: "in_app",
      txHash: executedHash,
      fromChain: input.fromChain,
      toChain: input.toChain,
      fromToken: live.fromCurrency || stored.fromCurrency,
      toToken: live.toCurrency || stored.toCurrency,
      fromAmount: live.fromAmount || stored.fromAmount,
      toAmount: live.toAmount || stored.toAmount,
      notionalUsdCents: stored.notionalUsdCents,
      executedAt: new Date(),
      rail: input.rail,
    });
    return { kind: "done" as const, status: live.status, result, notionalUsdCents: stored.notionalUsdCents };
  } catch (error) {
    if (error instanceof LedgerError) throw error;
    throw error;
  }
}
