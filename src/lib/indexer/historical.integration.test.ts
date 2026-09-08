import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { creditEvents, discoveredSwaps, users, wallets } from "@/lib/db/schema";
import { listUnclaimed, listWalletActivity } from "./claim";
import { asDate, persistCandidates, scanWallet } from "./scan";
import { summarizeWalletVolume } from "./summary";
import type { HistoricalCandidate } from "./types";

async function seedUser(db: Awaited<ReturnType<typeof createTestDb>>) {
  const userId = "user_hist_1";
  await db.insert(users).values({
    id: userId,
    chainNamespace: "eip155",
    address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  });
  await db.insert(wallets).values({ userId, creditCacheCents: 0, usdtCacheCents: 0, llmCacheCents: 0 });
  return userId;
}

function candidate(overrides: Partial<HistoricalCandidate> = {}): HistoricalCandidate {
  return {
    provider: "zerion",
    txHash: "0x" + "11".repeat(32),
    fromChain: "base",
    toChain: "base",
    fromToken: "ETH",
    toToken: "USDC",
    fromAmount: "0.2",
    toAmount: "512.77",
    notionalUsdCents: 51277,
    kind: "trade",
    executedAt: new Date("2026-08-01T12:00:00.000Z"),
    ...overrides,
  };
}

describe("historical scan → claim → ledger", () => {
  it("parses scan timestamps that arrive as strings", () => {
    const parsed = asDate("2026-09-06T06:00:00.000Z");
    expect(parsed?.getTime()).toBe(Date.parse("2026-09-06T06:00:00.000Z"));
  });

  it("stores sub-floor transfers with their USD value and keeps them off the claim list", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    const result = await persistCandidates(
      userId,
      [candidate({ notionalUsdCents: 24_999, txHash: "0x" + "22".repeat(32) })],
      25_000,
      db,
    );
    expect(result.inserted).toBe(1);
    expect(await listUnclaimed(userId, db)).toHaveLength(0);
    const activity = await listWalletActivity(userId, db);
    expect(activity).toHaveLength(1);
    expect(activity[0]?.status).toBe("below_threshold");
    expect(activity[0]?.notionalUsdCents).toBe(24_999);
  });

  it("shows sends in activity but does not make them claimable", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await persistCandidates(
      userId,
      [candidate({ kind: "send", notionalUsdCents: 80_000, txHash: "0x" + "33".repeat(32) })],
      25_000,
      db,
    );
    expect(await listUnclaimed(userId, db)).toHaveLength(0);
    const activity = await listWalletActivity(userId, db);
    expect(activity[0]?.kind).toBe("send");
    expect(activity[0]?.status).toBe("below_threshold");
  });

  it("sums swap volume only and ignores sends after $250 trade volume", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await persistCandidates(
      userId,
      [
        candidate({ notionalUsdCents: 20_000, txHash: "0x" + "41".repeat(32) }),
        candidate({ notionalUsdCents: 20_000, txHash: "0x" + "42".repeat(32) }),
        candidate({ kind: "send", notionalUsdCents: 15_000, txHash: "0x" + "43".repeat(32) }),
      ],
      25_000,
      db,
    );
    const activity = await listWalletActivity(userId, db);
    const summary = summarizeWalletVolume(activity, { conversionBps: 50 });
    expect(activity).toHaveLength(3);
    expect(summary.totalVolumeCents).toBe(40_000);
    expect(summary.qualifiesVolume).toBe(true);
    expect(summary.estimatedTotalRewardCents).toBe(200);
    expect(await listUnclaimed(userId, db)).toHaveLength(0);
  });

  it("scans through an injected source, claims once, and ignores a replay", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    const trade = candidate();

    const first = await scanWallet({
      userId,
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      sources: [{ name: "mock", fetchTrades: async () => [trade] }],
      db,
    });
    expect(first.inserted).toBe(1);
    // Auto-settle posts credit immediately so the user counts in public stats.
    expect(first.volumeReward?.creditedCents).toBe(256);
    expect(first.volumeReward?.status).toBe("rewarded");
    expect(await listUnclaimed(userId, db)).toHaveLength(0);

    const credits = await db.select().from(creditEvents);
    expect(credits).toHaveLength(1);

    const [row] = await db.select().from(discoveredSwaps);
    expect(row?.status).toBe("volume_settled");

    const replay = await scanWallet({
      userId,
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      sources: [{ name: "mock", fetchTrades: async () => [trade] }],
      force: true,
      db,
    });
    expect(replay.inserted).toBe(0);
    expect(await listUnclaimed(userId, db)).toHaveLength(0);
  });

  it("cools down after any scan, including an empty one", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    const empty = await scanWallet({
      userId,
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      sources: [{ name: "mock", fetchTrades: async () => [] }],
      db,
    });
    expect(empty.cooldown).toBeUndefined();

    const retryEmpty = await scanWallet({
      userId,
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      sources: [{ name: "mock", fetchTrades: async () => [] }],
      db,
    });
    expect(retryEmpty.cooldown).toBe(true);
    expect(retryEmpty.retryAfterSec).toBeGreaterThan(0);
  });

  it("returns the last scan when Zerion rate-limits", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await scanWallet({
      userId,
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      sources: [{ name: "mock", fetchTrades: async () => [candidate()] }],
      db,
    });
    const replay = await scanWallet({
      userId,
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      sources: [
        {
          name: "zerion",
          fetchTrades: async () => {
            throw new Error("zerion_429");
          },
        },
      ],
      force: true,
      db,
    });
    expect(replay.cached).toBe(true);
    expect(replay.scanned).toBe(1);
    expect(replay.cooldown).toBe(true);
  });
});
