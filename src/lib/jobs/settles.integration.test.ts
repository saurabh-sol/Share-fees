import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { pendingSettles, users, wallets } from "@/lib/db/schema";
import { upsertPendingSettle } from "./pending";
import { processPendingSettles } from "./settles";

async function seedUser(db: Awaited<ReturnType<typeof createTestDb>>) {
  const userId = "user_settle_1";
  await db.insert(users).values({
    id: userId,
    chainNamespace: "eip155",
    address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  });
  await db.insert(wallets).values({
    userId,
    creditCacheCents: 0,
    usdtCacheCents: 0,
    llmCacheCents: 0,
  });
  return userId;
}

describe("pending settle jobs", () => {
  it("credits user_credits when a pending LI.FI fill becomes DONE", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    const txHash = "0x" + "ab".repeat(32);
    await upsertPendingSettle(
      {
        userId,
        provider: "lifi",
        txHash,
        fromChain: "ethereum",
        toChain: "arbitrum",
        db,
      },
    );

    const processed = await processPendingSettles({
      db,
      settleLifi: async () => ({
        kind: "done",
        executedHash: txHash,
        fromToken: "ETH",
        toToken: "USDC",
        fromAmount: "0.2",
        toAmount: "500",
        notionalUsdCents: 50_000,
      }),
    });
    expect(processed[0]?.status).toBe("done");

    const [pending] = await db.select().from(pendingSettles);
    expect(pending?.status).toBe("done");
    const [wallet] = await db.select().from(wallets);
    expect(wallet?.creditCacheCents).toBe(250);
    expect(wallet?.usdtCacheCents).toBe(0);
    expect(wallet?.llmCacheCents).toBe(0);
  });

  it("leaves the row pending when the fill is not finished", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await upsertPendingSettle({
      userId,
      provider: "lifi",
      txHash: "0x" + "cd".repeat(32),
      fromChain: "ethereum",
      toChain: "arbitrum",
      db,
    });

    const processed = await processPendingSettles({
      db,
      settleLifi: async () => ({
        kind: "pending",
        status: { status: "PENDING" },
      }),
    });
    expect(processed[0]?.status).toBe("pending");
    const [pending] = await db.select().from(pendingSettles);
    expect(pending?.status).toBe("pending");
  });
});
