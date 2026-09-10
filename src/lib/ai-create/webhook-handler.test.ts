import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { aiGenerations, ledgerEntries, users, wallets } from "@/lib/db/schema";
import { newLedgerId } from "@/lib/ledger/post-swap-reward";
import { syncWalletCache } from "@/lib/ledger/balances";
import { handleReplicateWebhookPrediction } from "./webhook-handler";
import { getSpendableAiCreditCents } from "./ledger";

async function seedJob(db: Awaited<ReturnType<typeof createTestDb>>) {
  const userId = "user_ai_webhook";
  await db.insert(users).values({
    id: userId,
    chainNamespace: "eip155",
    address: "0x1111111111111111111111111111111111111111",
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
    amountCents: 500,
    referenceType: "test",
    referenceId: "seed_webhook",
  });
  await syncWalletCache(db, userId);

  const holdId = newLedgerId("hld");
  const { reserveAiCredit } = await import("./ledger");
  await reserveAiCredit(userId, holdId, 150, db);

  const jobId = "aig_webhook_1";
  await db.insert(aiGenerations).values({
    id: jobId,
    userId,
    modelId: "minimax-video-01",
    provider: "replicate",
    providerPredictionId: "pred_webhook_1",
    status: "processing",
    estimatedCostCents: 150,
    reservedCreditCents: 150,
    holdId,
    input: '{"prompt":"test video"}',
    idempotencyKey: "idem_webhook_1",
  });
  return { userId, jobId };
}

describe("handleReplicateWebhookPrediction", () => {
  it("finalizes a matched prediction and settles credits", async () => {
    const db = await createTestDb();
    const { userId, jobId } = await seedJob(db);

    const result = await handleReplicateWebhookPrediction(
      {
        id: "pred_webhook_1",
        status: "succeeded",
        input: { prompt: "test video" },
        output: "https://replicate.delivery/mock/output.png",
        error: null,
      },
      db,
    );

    expect(result.matched).toBe(true);
    expect(result.jobId).toBe(jobId);

    const [job] = await db.select().from(aiGenerations).where(eq(aiGenerations.id, jobId));
    expect(job?.status).toBe("succeeded");
    expect(job?.finalCostCents).toBe(150);
    expect(await getSpendableAiCreditCents(userId, db)).toBe(350);
  });

  it("ignores unknown predictions", async () => {
    const db = await createTestDb();
    const result = await handleReplicateWebhookPrediction(
      {
        id: "pred_missing",
        status: "succeeded",
        input: {},
        output: null,
        error: null,
      },
      db,
    );
    expect(result.matched).toBe(false);
  });
});
