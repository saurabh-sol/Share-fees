import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { creditEvents, discoveredSwaps, users, wallets } from "@/lib/db/schema";
import { claimDiscoveredSwap, listUnclaimed } from "./claim";
import { persistCandidates, scanWallet } from "./scan";
import type { HistoricalCandidate } from "./types";

async function seedUser(db: Awaited<ReturnType<typeof createTestDb>>) {
  const userId = "user_hist_1";
  await db.insert(users).values({
    id: userId,
    chainNamespace: "eip155",
    address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  });
  await db.insert(wallets).values({ userId, usdtCacheCents: 0, llmCacheCents: 0 });
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
    executedAt: new Date("2026-08-01T12:00:00.000Z"),
    ...overrides,
  };
}

describe("historical scan → claim → ledger", () => {
  it("keeps sub-floor trades out of the inbox", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    const result = await persistCandidates(
      userId,
      [candidate({ notionalUsdCents: 49_999, txHash: "0x" + "22".repeat(32) })],
      50_000,
      db,
    );
    expect(result.inserted).toBe(0);
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

    const inbox = await listUnclaimed(userId, db);
    expect(inbox).toHaveLength(1);

    const claimed = await claimDiscoveredSwap({
      userId,
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      claimId: inbox[0]!.id,
      rail: "llm_credits",
      reverify: async () => trade,
      db,
    });
    expect(claimed.creditedCents).toBe(256);
    expect(claimed.llmCents).toBe(256);

    const credits = await db.select().from(creditEvents);
    expect(credits).toHaveLength(1);

    const [row] = await db.select().from(discoveredSwaps).where(eq(discoveredSwaps.id, inbox[0]!.id));
    expect(row?.status).toBe("claimed");

    await expect(
      claimDiscoveredSwap({
        userId,
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        claimId: inbox[0]!.id,
        rail: "usdt",
        reverify: async () => trade,
        db,
      }),
    ).rejects.toThrow("claim_not_open");

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

  it("enforces scan cooldown", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await scanWallet({
      userId,
      address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      sources: [{ name: "mock", fetchTrades: async () => [] }],
      db,
    });
    await expect(
      scanWallet({
        userId,
        address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        sources: [{ name: "mock", fetchTrades: async () => [] }],
        db,
      }),
    ).rejects.toThrow("scan_cooldown");
  });
});
