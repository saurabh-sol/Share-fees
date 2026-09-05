import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { creditEvents, ledgerEntries, users, wallets } from "@/lib/db/schema";
import { postSwapReward } from "./post-swap-reward";

async function seedUser(db: Awaited<ReturnType<typeof createTestDb>>) {
  const userId = "user_test_1";
  await db.insert(users).values({
    id: userId,
    chainNamespace: "eip155",
    address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  });
  await db.insert(wallets).values({
    userId,
    usdtCacheCents: 0,
    llmCacheCents: 0,
  });
  return userId;
}

const fill = {
  userId: "user_test_1",
  source: "mock" as const,
  txHash: "0x" + "ab".repeat(32),
  fromChain: "ethereum",
  toChain: "arbitrum",
  fromToken: "ETH",
  toToken: "USDC",
  fromAmount: "0.42",
  toAmount: "764.18",
  notionalUsdCents: 76418,
  executedAt: new Date("2026-09-05T12:00:00.000Z"),
  rail: "usdt" as const,
};

describe("trade ingestion → credit → ledger → wallet", () => {
  it("credits 50 bps and keeps cache equal to summed ledger", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);

    const first = await postSwapReward({ ...fill, userId }, db);
    expect(first.alreadyExists).toBe(false);
    expect(first.status).toBe("rewarded");
    expect(first.creditedCents).toBe(382);
    expect(first.usdtCents).toBe(382);
    expect(first.llmCents).toBe(0);

    const credits = await db.select().from(creditEvents);
    expect(credits).toHaveLength(1);
    expect(credits[0]?.amountCents).toBe(382);

    const entries = await db.select().from(ledgerEntries);
    expect(entries).toHaveLength(2);
    const creditLeg = entries.find((row) => row.account === "user_usdt");
    const expenseLeg = entries.find((row) => row.account === "rewards_expense");
    expect(creditLeg?.type).toBe("credit");
    expect(expenseLeg?.type).toBe("debit");

    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    expect(wallet?.usdtCacheCents).toBe(382);

    const replay = await postSwapReward({ ...fill, userId }, db);
    expect(replay.alreadyExists).toBe(true);
    expect(replay.creditedCents).toBe(0);
    const creditsAfter = await db.select().from(creditEvents);
    expect(creditsAfter).toHaveLength(1);
  });

  it("stores a sub-$500 fill without writing a credit", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    const result = await postSwapReward(
      {
        ...fill,
        userId,
        txHash: "0x" + "cd".repeat(32),
        notionalUsdCents: 49_999,
      },
      db,
    );
    expect(result.status).toBe("below_threshold");
    expect(result.creditedCents).toBe(0);
    const credits = await db.select().from(creditEvents);
    expect(credits).toHaveLength(0);
  });

  it("posts LLM credits to the llm cache, not USDT", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    const result = await postSwapReward({ ...fill, userId, rail: "llm_credits" }, db);
    expect(result.llmCents).toBe(382);
    expect(result.usdtCents).toBe(0);
  });
});
