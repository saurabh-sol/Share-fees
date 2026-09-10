import { and, desc, eq } from "drizzle-orm";
import { normalizeAddress, type ChainNamespace } from "@/lib/auth/addresses";
import { getDb } from "@/lib/db/client";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROVIDER,
  assertProviderModel,
  type LlmProvider,
} from "@/lib/gateway/catalog";
import { creditConversions, ledgerEntries, payoutOutbox, redemptions, virtualKeys } from "@/lib/db/schema";
import { lockWalletRow, sumAccountCents, syncWalletCache } from "@/lib/ledger/balances";
import { isLlmChatRail, ledgerAccountForRail } from "@/lib/ledger/rail-accounts";
import { isStockRail, isUsdtLikeRail, type Rail } from "@/lib/ledger/post-swap-reward";
import { newLedgerId } from "@/lib/ledger/post-swap-reward";
import { issueVirtualKeyMaterial } from "./keys";
import { RedeemError } from "./errors";
import {
  isRedemptionClaimedOnChain,
  robinhoodPublicClient,
  type OnChainClaimVoucher,
} from "./reward-vault";
import { assertUsdgRedeemLimits } from "./limits";
import { assertStockInventoryForRedeem } from "./stock-inventory";
import { signUsdgClaimVoucher } from "./treasury";
import { assertUsdgClaimsOpen } from "@/lib/v2/upgrade";

export { RedeemError } from "./errors";

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export type RedeemInput = {
  userId: string;
  address: string;
  chainNamespace: ChainNamespace;
  rail: Rail;
  amountCents: number;
  idempotencyKey: string;
  provider?: LlmProvider;
  model?: string;
  clientIp?: string | null;
};

export function publicVirtualKey(row: typeof virtualKeys.$inferSelect) {
  return {
    id: row.id,
    prefix: row.prefix,
    spendCapCents: row.spendCapCents,
    spendUsedCents: row.spendUsedCents,
    remainingCents: row.spendCapCents - row.spendUsedCents,
    provider: row.provider,
    model: row.model,
    status: row.status,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
  };
}

/** Working map: credit → convert 1:1 → redeem(provider, model) → acc_ (LLM) or session EVM address (USDT). */
export async function redeem(input: RedeemInput, db?: Awaited<ReturnType<typeof getDb>>) {
  const client = db ?? (await getDb());

  const [existing] = await client
    .select()
    .from(redemptions)
    .where(
      and(eq(redemptions.userId, input.userId), eq(redemptions.idempotencyKey, input.idempotencyKey)),
    )
    .limit(1);
  if (existing) {
    const balances = await syncWalletCache(client, input.userId);
    return {
      alreadyExists: true,
      redemptionId: existing.id,
      status: existing.status,
      plaintextKey: null as string | null,
      keyPrefix: null as string | null,
      onChainClaim: await maybeSignQueuedUsdgClaim(existing),
      ...balances,
    };
  }

  if (isUsdtLikeRail(input.rail) && input.chainNamespace !== "eip155") {
    throw new RedeemError("usdt_evm_only", 400);
  }

  if (input.rail === "usdt") {
    assertUsdgClaimsOpen();
    await assertUsdgRedeemLimits(client, {
      userId: input.userId,
      amountCents: input.amountCents,
    });
  }

  if (isStockRail(input.rail)) {
    try {
      await assertStockInventoryForRedeem(input.rail, input.amountCents);
    } catch (error) {
      if (error instanceof Error && error.message === "stock_inventory_insufficient") {
        throw new RedeemError("stock_inventory_insufficient", 400);
      }
      throw error;
    }
  }

  if (input.rail === "ai_create_credits") {
    return client.transaction(async (tx) => {
      await lockWalletRow(tx as never, input.userId);
      const creditAvailable = await sumAccountCents(tx as never, input.userId, "user_credits");
      if (creditAvailable < input.amountCents) {
        throw new RedeemError("insufficient_balance", 400);
      }
      const redemptionId = newId("rdm");
      await tx.insert(redemptions).values({
        id: redemptionId,
        userId: input.userId,
        rail: input.rail,
        amountCents: input.amountCents,
        status: "fulfilled",
        destination: "ai_create",
        idempotencyKey: input.idempotencyKey,
        fulfilledAt: new Date(),
      });
      await tx.insert(ledgerEntries).values([
        {
          id: newId("led"),
          userId: input.userId,
          account: "user_credits",
          type: "debit",
          amountCents: input.amountCents,
          referenceType: "redemption",
          referenceId: redemptionId,
        },
        {
          id: newId("led"),
          userId: input.userId,
          account: "user_ai_create",
          type: "credit",
          amountCents: input.amountCents,
          referenceType: "redemption",
          referenceId: redemptionId,
        },
      ]);
      const balances = await syncWalletCache(tx as never, input.userId);
      return {
        alreadyExists: false,
        redemptionId,
        status: "fulfilled" as const,
        plaintextKey: null as string | null,
        keyPrefix: null as string | null,
        onChainClaim: null,
        ...balances,
      };
    });
  }

  let llm: ReturnType<typeof assertProviderModel> | null = null;
  if (input.rail === "llm_credits") {
    try {
      llm = assertProviderModel(
        input.provider ?? DEFAULT_LLM_PROVIDER,
        input.model ?? DEFAULT_LLM_MODEL,
      );
    } catch {
      throw new RedeemError("invalid_llm_model", 400);
    }
  }

  const account = ledgerAccountForRail(input.rail);
  const destination = isUsdtLikeRail(input.rail)
    ? normalizeAddress("eip155", input.address)
    : "gateway";

  return client.transaction(async (tx) => {
    await lockWalletRow(tx as never, input.userId);
    const railAvailable = await sumAccountCents(tx as never, input.userId, account);
    const creditAvailable = await sumAccountCents(tx as never, input.userId, "user_credits");
    const spendable = railAvailable + creditAvailable;
    if (spendable < input.amountCents) {
      throw new RedeemError("insufficient_balance", 400);
    }

    const fromCredit = Math.min(creditAvailable, input.amountCents);
    if (fromCredit > 0) {
      const conversionId = newLedgerId("cnv");
      await tx.insert(creditConversions).values({
        id: conversionId,
        userId: input.userId,
        rail: input.rail,
        amountCents: fromCredit,
        idempotencyKey: `rdm_${input.idempotencyKey}`,
      });
      await tx.insert(ledgerEntries).values([
        {
          id: newId("led"),
          userId: input.userId,
          account: "user_credits",
          type: "debit",
          amountCents: fromCredit,
          referenceType: "conversion",
          referenceId: conversionId,
        },
        {
          id: newId("led"),
          userId: input.userId,
          account,
          type: "credit",
          amountCents: fromCredit,
          referenceType: "conversion",
          referenceId: conversionId,
        },
      ]);
    }
    const redemptionId = newId("rdm");
    const initialStatus = isLlmChatRail(input.rail) ? "fulfilled" : "queued";

    await tx.insert(redemptions).values({
      id: redemptionId,
      userId: input.userId,
      rail: input.rail,
      amountCents: input.amountCents,
      status: initialStatus,
      destination,
      idempotencyKey: input.idempotencyKey,
      clientIp: isUsdtLikeRail(input.rail) ? input.clientIp?.trim() || null : null,
      fulfilledAt: isLlmChatRail(input.rail) ? new Date() : null,
    });

    await tx.insert(ledgerEntries).values([
      {
        id: newId("led"),
        userId: input.userId,
        account,
        type: "debit",
        amountCents: input.amountCents,
        referenceType: "redemption",
        referenceId: redemptionId,
      },
      {
        id: newId("led"),
        userId: input.userId,
        account: isUsdtLikeRail(input.rail) ? "payout_pool" : "redemption_pool",
        type: "credit",
        amountCents: input.amountCents,
        referenceType: "redemption",
        referenceId: redemptionId,
      },
    ]);

    let plaintextKey: string | null = null;
    let keyPrefix: string | null = null;

    if (isLlmChatRail(input.rail)) {
      const material = issueVirtualKeyMaterial();
      plaintextKey = material.raw;
      keyPrefix = material.prefix;
      await tx.insert(virtualKeys).values({
        id: newId("key"),
        userId: input.userId,
        redemptionId,
        keyHash: material.hash,
        prefix: material.prefix,
        spendCapCents: input.amountCents,
        spendUsedCents: 0,
        provider: llm?.provider ?? DEFAULT_LLM_PROVIDER,
        model: llm?.model ?? DEFAULT_LLM_MODEL,
        status: "active",
      });
    } else {
      await tx.insert(payoutOutbox).values({
        id: newId("out"),
        redemptionId,
        userId: input.userId,
        destination,
        amountCents: input.amountCents,
        chain: "robinhood",
        status: "queued",
      });
    }

    const balances = await syncWalletCache(tx as never, input.userId);
    return {
      alreadyExists: false,
      redemptionId,
      status: initialStatus,
      plaintextKey,
      keyPrefix,
      onChainClaim: null as OnChainClaimVoucher | null,
      ...balances,
    };
  }).then(async (result) => {
    if (input.rail !== "usdt" || !destination) return result;
    return {
      ...result,
      onChainClaim: await signUsdgClaimVoucher({
        redemptionId: result.redemptionId,
        destination,
        amountCents: input.amountCents,
      }),
    };
  });
}

async function maybeSignQueuedUsdgClaim(row: typeof redemptions.$inferSelect) {
  if (row.rail !== "usdt" || row.status !== "queued") return null;
  return signUsdgClaimVoucher({
    redemptionId: row.id,
    destination: row.destination,
    amountCents: row.amountCents,
  });
}

export async function listRedemptions(
  userId: string,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  const client = db ?? (await getDb());
  return client
    .select({
      id: redemptions.id,
      userId: redemptions.userId,
      rail: redemptions.rail,
      amountCents: redemptions.amountCents,
      status: redemptions.status,
      destination: redemptions.destination,
      idempotencyKey: redemptions.idempotencyKey,
      createdAt: redemptions.createdAt,
      fulfilledAt: redemptions.fulfilledAt,
      txHash: payoutOutbox.txHash,
    })
    .from(redemptions)
    .leftJoin(payoutOutbox, eq(payoutOutbox.redemptionId, redemptions.id))
    .where(eq(redemptions.userId, userId))
    .orderBy(desc(redemptions.createdAt))
    .limit(40);
}

export async function getRedemptionForUser(
  userId: string,
  redemptionId: string,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  const client = db ?? (await getDb());
  const [row] = await client
    .select()
    .from(redemptions)
    .where(and(eq(redemptions.id, redemptionId), eq(redemptions.userId, userId)))
    .limit(1);
  if (!row) return null;

  const [outbox] = await client
    .select()
    .from(payoutOutbox)
    .where(eq(payoutOutbox.redemptionId, row.id))
    .limit(1);
  const [key] = await client
    .select()
    .from(virtualKeys)
    .where(eq(virtualKeys.redemptionId, row.id))
    .limit(1);

  return {
    redemption: row,
    outbox: outbox ?? null,
    key: key ? publicVirtualKey(key) : null,
    onChainClaim: await maybeSignQueuedUsdgClaim(row),
  };
}

export async function confirmOnChainClaim(input: {
  userId: string;
  redemptionId: string;
  txHash: string;
  db?: Awaited<ReturnType<typeof getDb>>;
}) {
  const client = input.db ?? (await getDb());
  const detail = await getRedemptionForUser(input.userId, input.redemptionId, client);
  if (!detail) {
    throw new RedeemError("not_found", 404);
  }
  if (detail.redemption.rail !== "usdt") {
    throw new RedeemError("not_usdg_redemption", 400);
  }
  if (!detail.outbox) {
    throw new RedeemError("payout_missing", 400);
  }
  const hash = input.txHash.toLowerCase() as `0x${string}`;
  if (!/^0x[0-9a-f]{64}$/.test(hash)) {
    throw new RedeemError("invalid_tx_hash", 400);
  }

  if (detail.outbox.status === "sent" || detail.redemption.status === "fulfilled") {
    return {
      status: "fulfilled" as const,
      txHash: detail.outbox.txHash ?? hash,
      alreadyExists: true,
    };
  }

  const chain = robinhoodPublicClient();
  const receipt = await chain.waitForTransactionReceipt({ hash, timeout: 90_000 });
  if (receipt.status !== "success") {
    throw new RedeemError("tx_reverted", 409);
  }

  const onChain = await isRedemptionClaimedOnChain(detail.redemption.id);
  if (!onChain) {
    throw new RedeemError("claim_not_on_chain", 409);
  }

  await client
    .update(payoutOutbox)
    .set({
      status: "sent",
      txHash: hash,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(payoutOutbox.id, detail.outbox.id));
  await client
    .update(redemptions)
    .set({ status: "fulfilled", fulfilledAt: new Date() })
    .where(eq(redemptions.id, detail.redemption.id));

  return {
    status: "fulfilled" as const,
    txHash: hash,
    alreadyExists: false,
  };
}

export async function listVirtualKeys(
  userId: string,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  const client = db ?? (await getDb());
  const rows = await client
    .select()
    .from(virtualKeys)
    .where(eq(virtualKeys.userId, userId))
    .orderBy(desc(virtualKeys.createdAt));
  return rows.map(publicVirtualKey);
}

export async function revokeVirtualKey(input: {
  userId: string;
  keyId: string;
  db?: Awaited<ReturnType<typeof getDb>>;
}) {
  const client = input.db ?? (await getDb());
  const [row] = await client
    .select()
    .from(virtualKeys)
    .where(and(eq(virtualKeys.id, input.keyId), eq(virtualKeys.userId, input.userId)))
    .limit(1);
  if (!row) {
    throw new RedeemError("key_not_found", 404);
  }
  if (row.status === "revoked") {
    return publicVirtualKey(row);
  }
  const [updated] = await client
    .update(virtualKeys)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(eq(virtualKeys.id, row.id))
    .returning();
  return publicVirtualKey(updated ?? { ...row, status: "revoked", revokedAt: new Date() });
}

export class RedeemService {
  redeem = redeem;
}
