import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { users, wallets } from "@/lib/db/schema";
import { persistCandidates } from "@/lib/indexer/scan";
import { redeem } from "@/lib/redeem/service";
import { settleScannedVolumeReward } from "./volume-reward";

async function seedUser(db: Awaited<ReturnType<typeof createTestDb>>) {
  const userId = "user_vol_1";
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

describe("scanned volume reward", () => {
  it("posts BPS on $250+ volume and lets redeem spend it without a prior convert", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await persistCandidates(
      userId,
      [
        {
          provider: "zerion",
          txHash: "0x" + "21".repeat(32),
          fromChain: "base",
          toChain: "base",
          fromToken: "ETH",
          toToken: "USDC",
          fromAmount: "0.1",
          toAmount: "120",
          notionalUsdCents: 18_000,
          kind: "trade",
          executedAt: new Date("2026-08-01T12:00:00.000Z"),
        },
        {
          provider: "zerion",
          txHash: "0x" + "22".repeat(32),
          fromChain: "base",
          toChain: "base",
          fromToken: "ETH",
          toToken: "USDC",
          fromAmount: "0.1",
          toAmount: "100",
          notionalUsdCents: 10_000,
          kind: "send",
          executedAt: new Date("2026-08-02T12:00:00.000Z"),
        },
        {
          provider: "zerion",
          txHash: "0x" + "23".repeat(32),
          fromChain: "base",
          toChain: "base",
          fromToken: "ETH",
          toToken: "USDC",
          fromAmount: "0.08",
          toAmount: "80",
          notionalUsdCents: 8_000,
          kind: "trade",
          executedAt: new Date("2026-08-03T12:00:00.000Z"),
        },
      ],
      25_000,
      db,
    );

    const first = await settleScannedVolumeReward(userId, db);
    expect(first.creditedCents).toBe(100);
    expect(first.creditCents).toBe(100);

    const replay = await settleScannedVolumeReward(userId, db);
    expect(replay.creditedCents).toBe(0);
    expect(replay.creditCents).toBe(100);

    const redeemed = await redeem(
      {
        userId,
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        chainNamespace: "eip155",
        rail: "usdt",
        amountCents: 100,
        idempotencyKey: "rdm_volume_1",
      },
      db,
    );
    expect(redeemed.creditCents).toBe(0);
    expect(redeemed.usdtCents).toBe(0);
    expect(redeemed.status).toBe("queued");
  });
});
