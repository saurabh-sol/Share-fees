import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { changenowExchanges } from "@/lib/db/schema";
import { newLedgerId } from "@/lib/ledger/post-swap-reward";
import { ChangeNowError } from "./types";
import { decimalAmount, isNativeToken, loadMappedPair } from "./assets";
import { createChangeNowExchange, validateChangeNowAddress } from "./http";
import { quoteChangeNow } from "./quote";

export async function openChangeNowPayin(input: {
  userId: string;
  sessionAddress: string;
  fromChainId: number;
  toChainId: number;
  fromToken: string;
  toToken: string;
  fromAmount: string;
}) {
  const { from, to } = await loadMappedPair(input);
  const quoted = await quoteChangeNow(input);
  const payoutOk = await validateChangeNowAddress({
    address: input.sessionAddress,
    currency: to.ticker,
    network: to.network,
  });
  if (!payoutOk.result) {
    throw new ChangeNowError(
      payoutOk.message ?? "That payout address was rejected for this network.",
      400,
    );
  }
  const created = await createChangeNowExchange({
    fromCurrency: from.ticker,
    toCurrency: to.ticker,
    fromNetwork: from.network,
    toNetwork: to.network,
    fromAmount: decimalAmount(input.fromAmount, 18),
    address: input.sessionAddress,
    refundAddress: input.sessionAddress,
    userId: input.userId,
  });

  const db = await getDb();
  const rowId = newLedgerId("cnow");
  await db.insert(changenowExchanges).values({
    id: rowId,
    userId: input.userId,
    exchangeId: created.id,
    fromChain: String(input.fromChainId),
    toChain: String(input.toChainId),
    fromCurrency: created.fromCurrency,
    toCurrency: created.toCurrency,
    fromNetwork: created.fromNetwork,
    toNetwork: created.toNetwork,
    fromAmount: created.fromAmount,
    toAmount: created.toAmount || quoted.view.toAmount,
    payinAddress: created.payinAddress,
    payoutAddress: created.payoutAddress,
    status: created.status,
    notionalUsdCents: quoted.fromAmountUsdCents,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    id: rowId,
    exchangeId: created.id,
    payinAddress: created.payinAddress,
    payinExtraId: created.payinExtraId,
    fromAmount: created.fromAmount,
    toAmount: created.toAmount || quoted.view.toAmount,
    fromCurrency: created.fromCurrency,
    toCurrency: created.toCurrency,
    fromNetwork: created.fromNetwork,
    toNetwork: created.toNetwork,
    fromChainId: input.fromChainId,
    toChainId: input.toChainId,
    tokenAddress: from.tokenContract ?? input.fromToken,
    isNative: isNativeToken(from.tokenContract ?? input.fromToken),
    validUntil: created.validUntil,
    notionalUsdCents: quoted.fromAmountUsdCents,
    quote: quoted.view,
  };
}

export async function loadUserExchange(input: { userId: string; exchangeId: string }) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(changenowExchanges)
    .where(eq(changenowExchanges.exchangeId, input.exchangeId))
    .limit(1);
  if (!row) {
    throw new ChangeNowError("Unknown pay-in.", 404);
  }
  if (row.userId !== input.userId) {
    throw new ChangeNowError("exchange_not_owned", 403);
  }
  return row;
}
