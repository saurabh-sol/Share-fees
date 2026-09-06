import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { adminOverview } from "@/lib/admin/liability";
import { createTestDb } from "@/lib/db/client";
import { creditEvents, fraudFlags, rewardRules, users, wallets } from "@/lib/db/schema";
import { postSwapReward } from "@/lib/ledger/post-swap-reward";
import { resolveFraudFlag } from "./review";
import { isRoundTripWash } from "./wash";

const ADDRESS = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const outbound = {
  source: "mock" as const,
  txHash: "0x" + "aa".repeat(32),
  fromChain: "base",
  toChain: "base",
  fromToken: "ETH",
  toToken: "USDC",
  fromAmount: "0.2",
  toAmount: "512.77",
  notionalUsdCents: 51277,
  executedAt: new Date("2026-09-06T12:00:00.000Z"),
};

const inbound = {
  ...outbound,
  txHash: "0x" + "bb".repeat(32),
  fromToken: "USDC",
  toToken: "ETH",
  fromAmount: "512.77",
  toAmount: "0.2",
  executedAt: new Date("2026-09-06T12:20:00.000Z"),
};

async function seedUser(db: Awaited<ReturnType<typeof createTestDb>>, id = "user_phase4_1") {
  await db.insert(users).values({ id, chainNamespace: "eip155", address: ADDRESS });
  await db.insert(wallets).values({ userId: id, creditCacheCents: 0, usdtCacheCents: 0, llmCacheCents: 0 });
  return id;
}

describe("wash detection", () => {
  it("flags a same-chain A→B→A hop inside the window", () => {
    expect(isRoundTripWash(inbound, outbound)).toBe(true);
  });

  it("ignores a hop outside the window", () => {
    expect(
      isRoundTripWash(
        { ...inbound, executedAt: new Date("2026-09-06T14:00:00.000Z") },
        outbound,
      ),
    ).toBe(false);
  });
});

describe("phase 4 holds + admin review", () => {
  it("holds the return leg and credits after release", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);

    const first = await postSwapReward({ ...outbound, userId }, db);
    expect(first.status).toBe("rewarded");
    expect(first.creditedCents).toBe(256);
    expect(first.creditCents).toBe(256);

    const second = await postSwapReward({ ...inbound, userId }, db);
    expect(second.status).toBe("held");
    expect(second.creditedCents).toBe(0);
    expect(second.creditCents).toBe(256);
    expect(second.usdtCents).toBe(0);

    const flags = await db.select().from(fraudFlags);
    const open = flags.find((row) => row.status === "open");
    expect(open?.reason).toBe("wash_round_trip");
    expect(open?.rail).toBe("credits");

    const released = await resolveFraudFlag({
      flagId: open!.id,
      action: "release",
      reviewer: "admin",
      db,
    });
    expect(released.status).toBe("rewarded");
    expect(released.creditedCents).toBe(256);

    const credits = await db.select().from(creditEvents);
    expect(credits).toHaveLength(2);
    const overview = await adminOverview(db);
    expect(overview.userCreditsCents).toBe(512);
    expect(overview.userUsdtCents).toBe(0);
    expect(overview.rewardsExpenseCents).toBe(512);
    expect(overview.openFlags).toBe(0);
  });

  it("rejects a hold without writing a credit", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await postSwapReward({ ...outbound, userId }, db);
    await postSwapReward({ ...inbound, userId }, db);
    const [open] = await db.select().from(fraudFlags).where(eq(fraudFlags.status, "open"));
    const rejected = await resolveFraudFlag({
      flagId: open!.id,
      action: "reject",
      reviewer: "admin",
      db,
    });
    expect(rejected.status).toBe("rejected");
    expect(await db.select().from(creditEvents)).toHaveLength(1);
  });

  it("pauses credits when no rule is enabled", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db, "user_paused");
    await db.update(rewardRules).set({ enabled: 0 });
    const result = await postSwapReward({ ...outbound, userId }, db);
    expect(result.status).toBe("paused");
    expect(result.creditedCents).toBe(0);
    expect(await db.select().from(creditEvents)).toHaveLength(0);
  });
});
