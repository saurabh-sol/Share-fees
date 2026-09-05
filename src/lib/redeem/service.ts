import { and, desc, eq } from "drizzle-orm";
import { normalizeAddress, type ChainNamespace } from "@/lib/auth/addresses";
import { getDb } from "@/lib/db/client";
import { ledgerEntries, payoutOutbox, redemptions, virtualKeys } from "@/lib/db/schema";
import { sumAccountCents, syncWalletCache } from "@/lib/ledger/balances";
import type { Rail } from "@/lib/ledger/post-swap-reward";
import { issueVirtualKeyMaterial } from "./keys";

export class RedeemError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "RedeemError";
  }
}

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
};

export function publicVirtualKey(row: typeof virtualKeys.$inferSelect) {
  return {
    id: row.id,
    prefix: row.prefix,
    spendCapCents: row.spendCapCents,
    spendUsedCents: row.spendUsedCents,
    remainingCents: row.spendCapCents - row.spendUsedCents,
    status: row.status,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
  };
}

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
      ...balances,
    };
  }

  if (input.rail === "usdt" && input.chainNamespace !== "eip155") {
    throw new RedeemError("usdt_evm_only", 400);
  }

  const account = input.rail === "usdt" ? "user_usdt" : "user_llm";
  const available = await sumAccountCents(client, input.userId, account);
  if (available < input.amountCents) {
    throw new RedeemError("insufficient_balance", 400);
  }

  const destination =
    input.rail === "usdt" ? normalizeAddress("eip155", input.address) : "gateway";

  return client.transaction(async (tx) => {
    const redemptionId = newId("rdm");
    const initialStatus = input.rail === "usdt" ? "queued" : "fulfilled";

    await tx.insert(redemptions).values({
      id: redemptionId,
      userId: input.userId,
      rail: input.rail,
      amountCents: input.amountCents,
      status: initialStatus,
      destination,
      idempotencyKey: input.idempotencyKey,
      fulfilledAt: input.rail === "llm_credits" ? new Date() : null,
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
        account: input.rail === "usdt" ? "payout_pool" : "redemption_pool",
        type: "credit",
        amountCents: input.amountCents,
        referenceType: "redemption",
        referenceId: redemptionId,
      },
    ]);

    let plaintextKey: string | null = null;
    let keyPrefix: string | null = null;

    if (input.rail === "llm_credits") {
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
        status: "active",
      });
    } else {
      await tx.insert(payoutOutbox).values({
        id: newId("out"),
        redemptionId,
        userId: input.userId,
        destination,
        amountCents: input.amountCents,
        chain: "arbitrum",
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
      ...balances,
    };
  });
}

export async function listRedemptions(
  userId: string,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  const client = db ?? (await getDb());
  return client
    .select()
    .from(redemptions)
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
