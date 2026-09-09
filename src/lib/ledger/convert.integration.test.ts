import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { rewardRules, users, wallets } from "@/lib/db/schema";
import { convertCredits } from "./convert";
import { postSwapReward } from "./post-swap-reward";
import { rewardRuleSchema } from "@/lib/validation/swap";

async function seedUser(db: Awaited<ReturnType<typeof createTestDb>>, id = "user_cnv_1") {
  await db.insert(users).values({
    id,
    chainNamespace: "eip155",
    address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  });
  await db.insert(wallets).values({
    userId: id,
    creditCacheCents: 0,
    usdtCacheCents: 0,
    llmCacheCents: 0,
  });
  return id;
}

const baseFill = {
  source: "mock" as const,
  fromChain: "ethereum",
  toChain: "arbitrum",
  fromToken: "ETH",
  toToken: "USDC",
  fromAmount: "0.2",
  toAmount: "500",
  executedAt: new Date("2026-09-05T12:00:00.000Z"),
};

describe("claim then convert", () => {
  it("posts $500 at 50 bps onto website credit, then converts to the LLM rail", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    const posted = await postSwapReward(
      {
        ...baseFill,
        userId,
        txHash: "0x" + "aa".repeat(32),
        notionalUsdCents: 50_000,
      },
      db,
    );
    expect(posted.status).toBe("rewarded");
    expect(posted.creditedCents).toBe(250);

    const converted = await convertCredits(
      { userId, rail: "llm_credits", amountCents: 250, idempotencyKey: "cnv_full" },
      db,
    );
    expect(converted.creditCents).toBe(0);
    expect(converted.llmCents).toBe(250);
  });

  it("converts $1 of $2.50 then the remainder", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await postSwapReward(
      {
        ...baseFill,
        userId,
        txHash: "0x" + "bb".repeat(32),
        notionalUsdCents: 50_000,
      },
      db,
    );

    const first = await convertCredits(
      { userId, rail: "usdt", amountCents: 100, idempotencyKey: "cnv_part" },
      db,
    );
    expect(first.creditCents).toBe(150);
    expect(first.usdtCents).toBe(100);

    const rest = await convertCredits(
      { userId, rail: "usdt", amountCents: 150, idempotencyKey: "cnv_rest" },
      db,
    );
    expect(rest.creditCents).toBe(0);
    expect(rest.usdtCents).toBe(250);
  });

  it("credits $500 at 25 bps as 125 cents", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await db.update(rewardRules).set({ conversionBps: 25 }).where(eq(rewardRules.id, "rule_v1"));
    const posted = await postSwapReward(
      {
        ...baseFill,
        userId,
        txHash: "0x" + "cc".repeat(32),
        notionalUsdCents: 50_000,
      },
      db,
    );
    expect(posted.creditedCents).toBe(125);
    expect(posted.creditCents).toBe(125);
  });

  it("marks a computed reward under $1 as below_threshold", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await db
      .update(rewardRules)
      .set({ minNotionalUsdCents: 1, conversionBps: 50 })
      .where(eq(rewardRules.id, "rule_v1"));
    const posted = await postSwapReward(
      {
        ...baseFill,
        userId,
        txHash: "0x" + "dd".repeat(32),
        notionalUsdCents: 15_000,
      },
      db,
    );
    expect(posted.status).toBe("below_threshold");
    expect(posted.creditedCents).toBe(0);
    expect(posted.creditCents).toBe(0);
  });

  it("rejects an admin rule outside 25–100 bps", () => {
    expect(() =>
      rewardRuleSchema.parse({
        conversionBps: 200,
        minNotionalUsdCents: 50_000,
        dailyCapUsdCents: 250_000,
        enabled: true,
      }),
    ).toThrow();
    expect(() =>
      rewardRuleSchema.parse({
        conversionBps: 24,
        minNotionalUsdCents: 50_000,
        dailyCapUsdCents: 250_000,
        enabled: true,
      }),
    ).toThrow();
  });

  it("serializes parallel converts so they cannot overdraw website credit", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await postSwapReward(
      {
        ...baseFill,
        userId,
        txHash: "0x" + "ee".repeat(32),
        notionalUsdCents: 50_000,
      },
      db,
    );

    const results = await Promise.allSettled([
      convertCredits({ userId, rail: "usdt", amountCents: 250, idempotencyKey: "cnv_a" }, db),
      convertCredits({ userId, rail: "llm_credits", amountCents: 250, idempotencyKey: "cnv_b" }, db),
    ]);

    const fulfilled = results.filter((row) => row.status === "fulfilled");
    const rejected = results.filter((row) => row.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ message: "insufficient_credits" });

    const [wallet] = await db.select().from(wallets);
    expect(wallet?.creditCacheCents).toBe(0);
    expect(wallet?.usdtCacheCents + wallet?.llmCacheCents).toBe(250);
  });
});
