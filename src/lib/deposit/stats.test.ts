import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { accrDeposits, depositIntents, users, wallets } from "@/lib/db/schema";
import { getDepositStats, listDepositLeaderboard } from "./service";

async function seedUser(db: Awaited<ReturnType<typeof createTestDb>>, id: string, address: string) {
  await db.insert(users).values({ id, chainNamespace: "eip155", address });
  await db.insert(wallets).values({
    userId: id,
    creditCacheCents: 0,
    usdtCacheCents: 0,
    llmCacheCents: 0,
  });
}

describe("deposit stats", () => {
  it("lists leaderboard rows after a credited deposit", async () => {
    const db = await createTestDb();
    const userId = "user_dep_stats";
    await seedUser(db, userId, "0xabababababababababababababababababababab");

    await db.insert(depositIntents).values({
      id: "dep_stats_1",
      userId,
      usdCents: 500,
      tokenAmountRaw: "1000000000000000000",
      tokenAmountHuman: "1",
      priceUsd: "0.05",
      displayCreditCents: 1000,
      grantedLlmCents: 300,
      status: "credited",
      expiresAt: new Date("2026-12-31T00:00:00.000Z"),
    });
    await db.insert(accrDeposits).values({
      id: "acd_stats_1",
      userId,
      intentId: "dep_stats_1",
      txHash: "0x" + "55".repeat(32),
      tokenAmountRaw: "1000000000000000000",
      usdCentsAtDeposit: 500,
      displayCreditCents: 1000,
      grantedLlmCents: 300,
      priceUsd: "0.05",
      status: "credited",
    });

    const stats = await getDepositStats(db);
    const leaderboard = await listDepositLeaderboard(100, db);

    expect(stats.uniqueDepositors).toBe(1);
    expect(stats.totalDeposits).toBe(1);
    expect(stats.totalUsdCents).toBe(500);
    expect(leaderboard).toHaveLength(1);
    expect(leaderboard[0]?.address).toBe("0xabababababababababababababababababababab");
    expect(leaderboard[0]?.totalUsdCents).toBe(500);
  });
});
