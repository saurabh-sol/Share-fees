import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { ledgerEntries, payoutOutbox, redemptions, users, virtualKeys, wallets } from "@/lib/db/schema";
import { GatewayError, authenticateVirtualKey, consumeVirtualKey, handleChatCompletion } from "@/lib/gateway/service";
import { convertCredits } from "@/lib/ledger/convert";
import { postSwapReward } from "@/lib/ledger/post-swap-reward";
import { processPayoutOutbox } from "@/lib/jobs/payouts";
import { hashVirtualKey } from "./keys";
import { RedeemError, redeem, revokeVirtualKey } from "./service";
import { treasuryCanBroadcast } from "./treasury";

const ADDRESS = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const fill = {
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

async function seedUser(
  db: Awaited<ReturnType<typeof createTestDb>>,
  id = "user_phase3_1",
  namespace: "eip155" | "solana" = "eip155",
) {
  await db.insert(users).values({
    id,
    chainNamespace: namespace,
    address: ADDRESS,
  });
  await db.insert(wallets).values({
    userId: id,
    creditCacheCents: 0,
    usdtCacheCents: 0,
    llmCacheCents: 0,
  });
  return id;
}

async function claimThenConvert(
  db: Awaited<ReturnType<typeof createTestDb>>,
  userId: string,
  rail: "usdt" | "llm_credits",
  overrides: Partial<typeof fill> = {},
) {
  const posted = await postSwapReward({ ...fill, ...overrides, userId }, db);
  if (posted.creditedCents > 0) {
    await convertCredits(
      {
        userId,
        rail,
        amountCents: posted.creditedCents,
        idempotencyKey: `cnv_${overrides.txHash ?? fill.txHash}`,
      },
      db,
    );
  }
  return posted;
}

const chatBody = {
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "ping" }],
};

describe("phase 3 redeem + gateway", () => {
  it("issues an LLM key once, stores only the hash, and refuses a replay plaintext", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await claimThenConvert(db, userId, "llm_credits");

    const first = await redeem(
      {
        userId,
        address: ADDRESS,
        chainNamespace: "eip155",
        rail: "llm_credits",
        amountCents: 100,
        idempotencyKey: "idem_llm_1",
      },
      db,
    );
    expect(first.alreadyExists).toBe(false);
    expect(first.status).toBe("fulfilled");
    expect(first.plaintextKey?.startsWith("t2c_")).toBe(true);
    expect(first.llmCents).toBe(282);

    const keys = await db.select().from(virtualKeys);
    expect(keys).toHaveLength(1);
    expect(keys[0]?.keyHash).toBe(hashVirtualKey(first.plaintextKey!));
    expect(keys[0]?.provider).toBe("openai");
    expect(keys[0]?.model).toBe("gpt-4o-mini");
    expect(keys[0]?.spendCapCents).toBe(100);
    expect(JSON.stringify(keys)).not.toContain(first.plaintextKey);

    const replay = await redeem(
      {
        userId,
        address: ADDRESS,
        chainNamespace: "eip155",
        rail: "llm_credits",
        amountCents: 100,
        idempotencyKey: "idem_llm_1",
      },
      db,
    );
    expect(replay.alreadyExists).toBe(true);
    expect(replay.plaintextKey).toBeNull();
    expect(await db.select().from(virtualKeys)).toHaveLength(1);
    expect(await db.select().from(redemptions)).toHaveLength(1);
  });

  it("rejects a redeem above the available rail balance", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await postSwapReward({ ...fill, userId }, db);

    await expect(
      redeem(
        {
          userId,
          address: ADDRESS,
          chainNamespace: "eip155",
          rail: "usdt",
          amountCents: 10_000,
          idempotencyKey: "idem_short",
        },
        db,
      ),
    ).rejects.toMatchObject({ name: "RedeemError", message: "insufficient_balance" } satisfies Partial<RedeemError>);
  });

  it("queues USDT to the session wallet without broadcasting when treasury is locked", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await claimThenConvert(db, userId, "usdt");
    expect(treasuryCanBroadcast()).toBe(false);

    const result = await redeem(
      {
        userId,
        address: ADDRESS,
        chainNamespace: "eip155",
        rail: "usdt",
        amountCents: 150,
        idempotencyKey: "idem_usdt_1",
      },
      db,
    );
    expect(result.status).toBe("queued");
    expect(result.usdtCents).toBe(232);

    const entries = await db.select().from(ledgerEntries);
    expect(entries.some((row) => row.account === "user_usdt" && row.type === "debit" && row.amountCents === 150)).toBe(
      true,
    );
    expect(entries.some((row) => row.account === "payout_pool" && row.type === "credit")).toBe(true);

    const [outbox] = await db.select().from(payoutOutbox);
    expect(outbox?.status).toBe("queued");
    expect(outbox?.destination).toBe(ADDRESS);
    expect(outbox?.txHash).toBeNull();

    const idle = await processPayoutOutbox({ db });
    expect(idle[0]?.status).toBe("queued");
    const [still] = await db.select().from(payoutOutbox);
    expect(still?.status).toBe("queued");
  });

  it("marks the outbox sent when a broadcast function is injected", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await claimThenConvert(db, userId, "usdt");
    await redeem(
      {
        userId,
        address: ADDRESS,
        chainNamespace: "eip155",
        rail: "usdt",
        amountCents: 100,
        idempotencyKey: "idem_usdt_send",
      },
      db,
    );

    const hash = "0x" + "ee".repeat(32);
    const processed = await processPayoutOutbox({
      db,
      broadcast: async ({ destination, amountCents }) => {
        expect(destination).toBe(ADDRESS);
        expect(amountCents).toBe(100);
        return hash;
      },
    });
    expect(processed[0]?.status).toBe("sent");
    expect(processed[0]?.txHash).toBe(hash);

    const [outbox] = await db.select().from(payoutOutbox);
    expect(outbox?.status).toBe("sent");
    const [row] = await db.select().from(redemptions);
    expect(row?.status).toBe("fulfilled");
  });

  it("refunds user_usdt after the payout worker exhausts attempts", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await claimThenConvert(db, userId, "usdt");
    await redeem(
      {
        userId,
        address: ADDRESS,
        chainNamespace: "eip155",
        rail: "usdt",
        amountCents: 100,
        idempotencyKey: "idem_usdt_fail",
      },
      db,
    );
    await db.update(payoutOutbox).set({ attempts: 7 });

    const processed = await processPayoutOutbox({
      db,
      broadcast: async () => {
        throw new Error("rpc_down");
      },
    });
    expect(processed[0]?.status).toBe("failed");
    const [outbox] = await db.select().from(payoutOutbox);
    expect(outbox?.status).toBe("failed");
    const [row] = await db.select().from(redemptions);
    expect(row?.status).toBe("refunded");
    const [wallet] = await db.select().from(wallets);
    expect(wallet?.usdtCacheCents).toBe(382);
  });

  it("rejects a bad gateway key and decrements cap through a mock forwarder", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await claimThenConvert(db, userId, "llm_credits");
    const issued = await redeem(
      {
        userId,
        address: ADDRESS,
        chainNamespace: "eip155",
        rail: "llm_credits",
        amountCents: 100,
        idempotencyKey: "idem_gw_1",
      },
      db,
    );

    await expect(authenticateVirtualKey("t2c_deadbeef", db)).rejects.toBeInstanceOf(GatewayError);
    await expect(
      handleChatCompletion({
        authorization: "Bearer sk-openai",
        body: chatBody,
        db,
        forward: async () => {
          throw new Error("should_not_forward");
        },
      }),
    ).rejects.toMatchObject({ message: "invalid_api_key" });

    const response = await handleChatCompletion({
      authorization: `Bearer ${issued.plaintextKey}`,
      body: chatBody,
      db,
      forward: async () => ({
        response: Response.json({ id: "chat_1", choices: [] }),
        promptTokens: 100,
        completionTokens: 50,
        model: "gpt-4o-mini",
      }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("X-T2C-Remaining-Cents")).toBe("99");

    const [key] = await db.select().from(virtualKeys);
    expect(key?.spendUsedCents).toBe(1);
    expect(key?.spendCapCents).toBe(100);

    await consumeVirtualKey(key!.id, 99, db);
    await expect(authenticateVirtualKey(issued.plaintextKey!, db)).rejects.toMatchObject({
      message: "insufficient_credits",
    });
  });

  it("reserves the remaining cap so a parallel gateway call cannot overspend", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await claimThenConvert(db, userId, "llm_credits");
    const issued = await redeem(
      {
        userId,
        address: ADDRESS,
        chainNamespace: "eip155",
        rail: "llm_credits",
        amountCents: 100,
        idempotencyKey: "idem_gw_race",
      },
      db,
    );

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = handleChatCompletion({
      authorization: `Bearer ${issued.plaintextKey}`,
      body: chatBody,
      db,
      forward: async () => {
        await gate;
        return {
          response: Response.json({ id: "chat_1", choices: [] }),
          promptTokens: 100,
          completionTokens: 50,
          model: "gpt-4o-mini",
        };
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 40));
    await expect(
      handleChatCompletion({
        authorization: `Bearer ${issued.plaintextKey}`,
        body: chatBody,
        db,
        forward: async () => ({
          response: Response.json({ id: "chat_2", choices: [] }),
          promptTokens: 100,
          completionTokens: 50,
          model: "gpt-4o-mini",
        }),
      }),
    ).rejects.toMatchObject({ message: "insufficient_credits" });
    release();
    const response = await first;
    expect(response.status).toBe(200);
    expect(response.headers.get("X-T2C-Remaining-Cents")).toBe("99");
  });

  it("rejects a revoked key on the next gateway request", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await claimThenConvert(db, userId, "llm_credits");
    const issued = await redeem(
      {
        userId,
        address: ADDRESS,
        chainNamespace: "eip155",
        rail: "llm_credits",
        amountCents: 100,
        idempotencyKey: "idem_revoke",
      },
      db,
    );
    const [row] = await db.select().from(virtualKeys);
    await revokeVirtualKey({ userId, keyId: row!.id, db });
    await expect(authenticateVirtualKey(issued.plaintextKey!, db)).rejects.toMatchObject({
      message: "invalid_api_key",
    });
  });

  it("blocks USDT redeem for a Solana session", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db, "user_sol_1", "solana");
    await postSwapReward({ ...fill, userId, txHash: "0x" + "cd".repeat(32) }, db);
    await expect(
      redeem(
        {
          userId,
          address: ADDRESS,
          chainNamespace: "solana",
          rail: "usdt",
          amountCents: 100,
          idempotencyKey: "idem_sol",
        },
        db,
      ),
    ).rejects.toMatchObject({ message: "usdt_evm_only" });
  });

  it("binds an LLM key to Anthropic and rejects an OpenAI model", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db, "user_anth_1");
    await claimThenConvert(db, userId, "llm_credits", { txHash: "0x" + "11".repeat(32) });
    const issued = await redeem(
      {
        userId,
        address: ADDRESS,
        chainNamespace: "eip155",
        rail: "llm_credits",
        amountCents: 100,
        idempotencyKey: "idem_anth_1",
        provider: "anthropic",
        model: "claude-sonnet-5",
      },
      db,
    );
    const [key] = await db.select().from(virtualKeys);
    expect(key?.provider).toBe("anthropic");
    expect(key?.model).toBe("claude-sonnet-5");
    expect(key?.spendCapCents).toBe(100);

    await expect(
      handleChatCompletion({
        authorization: `Bearer ${issued.plaintextKey}`,
        body: { ...chatBody, model: "gpt-4o" },
        db,
        forward: async () => {
          throw new Error("should_not_forward");
        },
      }),
    ).rejects.toMatchObject({ message: "model_not_allowed" });
  });
});
