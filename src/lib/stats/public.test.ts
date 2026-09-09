import { describe, expect, it, beforeEach } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { publicDeskStatsBaseline, redemptions, users, wallets } from "@/lib/db/schema";
import { postSwapReward } from "@/lib/ledger/post-swap-reward";
import {
  clearPublicDeskStatsCacheForTest,
  getPublicDeskStats,
} from "./public";

async function seedUser(
  db: Awaited<ReturnType<typeof createTestDb>>,
  id: string,
  address: string,
) {
  await db.insert(users).values({
    id,
    chainNamespace: "eip155",
    address,
  });
  await db.insert(wallets).values({
    userId: id,
    creditCacheCents: 0,
    usdtCacheCents: 0,
    llmCacheCents: 0,
  });
}

const baseFill = {
  fromChain: "8453",
  toChain: "42161",
  fromToken: "ETH",
  toToken: "USDC",
  fromAmount: "0.42",
  toAmount: "764.18",
  notionalUsdCents: 764_18,
  executedAt: new Date("2026-09-05T12:00:00.000Z"),
};

describe("public desk stats", () => {
  beforeEach(() => {
    clearPublicDeskStatsCacheForTest();
  });

  it("returns zeros before any credited fill", async () => {
    const db = await createTestDb();
    const stats = await getPublicDeskStats({ fresh: true, db });
    expect(stats).toMatchObject({
      activeWallets: 0,
      claimedLlmCreditsUsd: 0,
      creditPaidUsd: 0,
      swapVolumeUsd: 0,
    });
  });

  it("counts one active wallet after a rewarded in-app fill", async () => {
    const db = await createTestDb();
    const userId = "user_stats_1";
    await seedUser(db, userId, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

    await postSwapReward(
      {
        ...baseFill,
        userId,
        source: "in_app",
        txHash: "0x" + "ab".repeat(32),
      },
      db,
    );

    const stats = await getPublicDeskStats({ fresh: true, db });
    expect(stats?.activeWallets).toBe(1);
    expect(stats?.claimedLlmCreditsUsd).toBe(0);
    expect(stats?.creditPaidUsd).toBe(4);
    expect(stats?.swapVolumeUsd).toBe(764);
  });

  it("excludes mock fills from public stats", async () => {
    const db = await createTestDb();
    const userId = "user_stats_mock";
    await seedUser(db, userId, "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");

    await postSwapReward(
      {
        ...baseFill,
        userId,
        source: "mock",
        txHash: "0x" + "cc".repeat(32),
      },
      db,
    );

    const stats = await getPublicDeskStats({ fresh: true, db });
    expect(stats?.activeWallets).toBe(0);
    expect(stats?.claimedLlmCreditsUsd).toBe(0);
  });

  it("applies DB floors when live totals are lower", async () => {
    const db = await createTestDb();
    await db.insert(publicDeskStatsBaseline).values({
      id: "default",
      minActiveWallets: 45,
      minClaimedLlmCents: 8500,
      minSwapVolumeUsd: 350_000,
    });
    const stats = await getPublicDeskStats({ fresh: true, db });
    expect(stats.activeWallets).toBe(45);
    expect(stats.claimedLlmCreditsUsd).toBe(85);
    expect(stats.swapVolumeUsd).toBe(350_000);
  });

  it("grows above the floor when live LLM redemptions exceed it", async () => {
    const db = await createTestDb();
    await db.insert(publicDeskStatsBaseline).values({
      id: "default",
      minActiveWallets: 45,
      minClaimedLlmCents: 8500,
      minSwapVolumeUsd: 350_000,
    });
    const userId = "user_stats_llm_high";
    await seedUser(db, userId, "0xffffffffffffffffffffffffffffffffffffffff");
    await db.insert(redemptions).values({
      id: "red_llm_big",
      userId,
      rail: "llm_credits",
      amountCents: 10_000,
      status: "fulfilled",
      destination: userId,
      idempotencyKey: "idem_big",
    });
    const stats = await getPublicDeskStats({ fresh: true, db });
    expect(stats.claimedLlmCreditsUsd).toBe(100);
    expect(stats.activeWallets).toBe(45);
  });

  it("sums claimed LLM credits from llm_credits redemptions", async () => {
    const db = await createTestDb();
    const userId = "user_stats_llm";
    await seedUser(db, userId, "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
    await db.insert(redemptions).values([
      {
        id: "red_llm_1",
        userId,
        rail: "llm_credits",
        amountCents: 122,
        status: "fulfilled",
        destination: userId,
        idempotencyKey: "idem_1",
      },
      {
        id: "red_llm_2",
        userId,
        rail: "llm_credits",
        amountCents: 500,
        status: "fulfilled",
        destination: userId,
        idempotencyKey: "idem_2",
      },
    ]);

    const stats = await getPublicDeskStats({ fresh: true, db });
    expect(stats?.claimedLlmCreditsUsd).toBe(6.22);
  });

  it("counts distinct wallets across multiple credited fills", async () => {
    const db = await createTestDb();
    await seedUser(db, "user_stats_a", "0xcccccccccccccccccccccccccccccccccccccccc");
    await seedUser(db, "user_stats_b", "0xdddddddddddddddddddddddddddddddddddddddd");

    await postSwapReward(
      {
        ...baseFill,
        userId: "user_stats_a",
        source: "in_app",
        txHash: "0x" + "11".repeat(32),
      },
      db,
    );
    await postSwapReward(
      {
        ...baseFill,
        userId: "user_stats_b",
        source: "historical",
        txHash: "0x" + "22".repeat(32),
      },
      db,
    );

    const stats = await getPublicDeskStats({ fresh: true, db });
    expect(stats?.activeWallets).toBe(2);
    expect(stats?.claimedLlmCreditsUsd).toBe(0);
    expect(stats?.creditPaidUsd).toBe(8);
    expect(stats?.swapVolumeUsd).toBe(1528);
  });
});
