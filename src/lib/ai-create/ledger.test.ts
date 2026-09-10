import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { aiGenerations, ledgerEntries, users, wallets } from "@/lib/db/schema";
import {
  getSpendableAiCreditCents,
  releaseAiCreditHold,
  reserveAiCredit,
  settleAiCreditHold,
} from "./ledger";
import { newLedgerId } from "@/lib/ledger/post-swap-reward";
import { syncWalletCache } from "@/lib/ledger/balances";

async function seedUserWithCreateCredits(
  db: Awaited<ReturnType<typeof createTestDb>>,
  userId: string,
  createCents: number,
) {
  await db.insert(users).values({
    id: userId,
    chainNamespace: "eip155",
    address: `0x${userId.padEnd(40, "0").slice(0, 40)}`,
  });
  await db.insert(wallets).values({
    userId,
    creditCacheCents: 0,
    usdtCacheCents: 0,
    llmCacheCents: 0,
    aiCreateCacheCents: 0,
  });
  await db.insert(ledgerEntries).values({
    id: newLedgerId("led"),
    userId,
    account: "user_ai_create",
    type: "credit",
    amountCents: createCents,
    referenceType: "test",
    referenceId: `seed_${userId}`,
  });
  await syncWalletCache(db, userId);
}

describe("ai create ledger", () => {
  it("reserves, settles partial, and releases remaining hold", async () => {
    const db = await createTestDb();
    const userId = "user_ai_ledger";
    await seedUserWithCreateCredits(db, userId, 300);

    const holdId = newLedgerId("hld");
    await reserveAiCredit(userId, holdId, 10, db);
    expect(await getSpendableAiCreditCents(userId, db)).toBe(290);

    const jobId = "aig_test_1";
    await db.insert(aiGenerations).values({
      id: jobId,
      userId,
      modelId: "flux-schnell",
      provider: "replicate",
      status: "processing",
      estimatedCostCents: 10,
      reservedCreditCents: 10,
      holdId,
      input: '{"prompt":"test"}',
      idempotencyKey: "idem_ai_1",
    });

    await settleAiCreditHold(userId, holdId, 7, jobId, db);
    expect(await getSpendableAiCreditCents(userId, db)).toBe(293);
  });

  it("releases full hold on failure", async () => {
    const db = await createTestDb();
    const userId = "user_ai_release";
    await seedUserWithCreateCredits(db, userId, 100);

    const holdId = newLedgerId("hld");
    await reserveAiCredit(userId, holdId, 10, db);
    await releaseAiCreditHold(userId, holdId, db);
    expect(await getSpendableAiCreditCents(userId, db)).toBe(100);
  });
});
