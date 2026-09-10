import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { aiGenerations, users, wallets } from "@/lib/db/schema";
import { aiCreateOverview } from "./stats";

describe("aiCreateOverview", () => {
  it("counts succeeded spend for the UTC day", async () => {
    const db = await createTestDb();
    const userId = "user_ai_stats";
    await db.insert(users).values({
      id: userId,
      chainNamespace: "eip155",
      address: "0x2222222222222222222222222222222222222222",
    });
    await db.insert(wallets).values({
      userId,
      creditCacheCents: 0,
      usdtCacheCents: 0,
      llmCacheCents: 0,
    });

    await db.insert(aiGenerations).values({
      id: "aig_stats_1",
      userId,
      modelId: "flux-schnell",
      provider: "replicate",
      status: "succeeded",
      estimatedCostCents: 10,
      reservedCreditCents: 10,
      finalCostCents: 10,
      holdId: "hld_stats_1",
      input: '{"prompt":"x"}',
      idempotencyKey: "idem_stats_1",
      completedAt: new Date(),
    });

    const overview = await aiCreateOverview(db);
    expect(overview.spendTodayCents).toBeGreaterThanOrEqual(10);
    expect(overview.succeededToday).toBeGreaterThanOrEqual(1);
  });
});
