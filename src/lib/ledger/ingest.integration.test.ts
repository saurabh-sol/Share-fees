import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { creditEvents, ledgerEntries, users, wallets } from "@/lib/db/schema";
import { convertCredits } from "./convert";
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
    creditCacheCents: 0,
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
};

describe("trade ingestion → website credit → convert", () => {
  it("credits 50 bps onto user_credits, not a rail", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);

    const first = await postSwapReward({ ...fill, userId }, db);
    expect(first.alreadyExists).toBe(false);
    expect(first.status).toBe("rewarded");
    expect(first.creditedCents).toBe(382);
    expect(first.creditCents).toBe(382);
    expect(first.usdtCents).toBe(0);
    expect(first.llmCents).toBe(0);

    const credits = await db.select().from(creditEvents);
    expect(credits).toHaveLength(1);
    expect(credits[0]?.rail).toBe("credits");

    const entries = await db.select().from(ledgerEntries);
    expect(entries.find((row) => row.account === "user_credits")?.type).toBe("credit");
    expect(entries.find((row) => row.account === "rewards_expense")?.type).toBe("debit");

    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    expect(wallet?.creditCacheCents).toBe(382);

    const replay = await postSwapReward({ ...fill, userId }, db);
    expect(replay.alreadyExists).toBe(true);
    expect(replay.creditedCents).toBe(0);
    expect(await db.select().from(creditEvents)).toHaveLength(1);
  });

  it("converts part of website credit to the LLM rail", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await postSwapReward({ ...fill, userId }, db);

    const converted = await convertCredits(
      { userId, rail: "llm_credits", amountCents: 100, idempotencyKey: "cnv_partial" },
      db,
    );
    expect(converted.creditCents).toBe(282);
    expect(converted.llmCents).toBe(100);

    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    expect(wallet?.creditCacheCents).toBe(282);
    expect(wallet?.llmCacheCents).toBe(100);
  });

  it("stores a sub-$250 fill without writing a credit", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    const result = await postSwapReward(
      {
        ...fill,
        userId,
        txHash: "0x" + "cd".repeat(32),
        notionalUsdCents: 24_999,
      },
      db,
    );
    expect(result.status).toBe("below_threshold");
    expect(result.creditedCents).toBe(0);
    expect(await db.select().from(creditEvents)).toHaveLength(0);
  });

  it("rejects a convert larger than website credit", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await postSwapReward({ ...fill, userId }, db);
    await expect(
      convertCredits({ userId, rail: "usdt", amountCents: 10_000, idempotencyKey: "cnv_over" }, db),
    ).rejects.toMatchObject({ message: "insufficient_credits" });
  });
});
