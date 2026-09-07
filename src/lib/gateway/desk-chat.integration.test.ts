import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { users, virtualKeys, wallets } from "@/lib/db/schema";
import { postSwapReward } from "@/lib/ledger/post-swap-reward";
import { spendableLlmCents } from "@/lib/ledger/desk-chat";
import { redeem } from "@/lib/redeem/service";
import { handleDeskChat } from "./desk-chat";
import { GatewayError } from "./errors";

const ADDRESS = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

async function seedUser(db: Awaited<ReturnType<typeof createTestDb>>) {
  const userId = "user_desk_chat_1";
  await db.insert(users).values({
    id: userId,
    chainNamespace: "eip155",
    address: ADDRESS,
  });
  await db.insert(wallets).values({
    userId,
    creditCacheCents: 0,
    usdtCacheCents: 0,
    llmCacheCents: 0,
  });
  return userId;
}

describe("desk chat", () => {
  it("requires a redeemed LLM key before chat can spend", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await postSwapReward(
      {
        userId,
        source: "mock",
        txHash: `0x${"ab".repeat(32)}`,
        fromChain: "ethereum",
        toChain: "base",
        fromToken: "ETH",
        toToken: "USDC",
        fromAmount: "0.4",
        toAmount: "800",
        notionalUsdCents: 80_000,
        executedAt: new Date("2026-09-06T12:00:00.000Z"),
      },
      db,
    );

    const before = await spendableLlmCents(userId, db);
    expect(before.creditCents).toBeGreaterThan(0);
    expect(before.spendableCents).toBe(0);

    await expect(
      handleDeskChat({
        userId,
        provider: "openai",
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Hello" }],
        db,
        forward: async () => {
          throw new Error("should_not_call");
        },
      }),
    ).rejects.toMatchObject({ name: "GatewayError", message: "redeem_required" });
  });

  it("calls the model and charges a redeemed key", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await postSwapReward(
      {
        userId,
        source: "mock",
        txHash: `0x${"ab".repeat(32)}`,
        fromChain: "ethereum",
        toChain: "base",
        fromToken: "ETH",
        toToken: "USDC",
        fromAmount: "0.4",
        toAmount: "800",
        notionalUsdCents: 80_000,
        executedAt: new Date("2026-09-06T12:00:00.000Z"),
      },
      db,
    );

    const redeemed = await redeem(
      {
        userId,
        address: ADDRESS,
        chainNamespace: "eip155",
        rail: "llm_credits",
        amountCents: 100,
        idempotencyKey: "idem_desk_chat",
      },
      db,
    );
    expect(redeemed.plaintextKey?.startsWith("t2c_")).toBe(true);

    const before = await spendableLlmCents(userId, db);
    expect(before.spendableCents).toBe(100);

    const result = await handleDeskChat({
      userId,
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hello" }],
      db,
      forward: async () => ({
        response: Response.json({
          id: "chat_desk",
          choices: [{ message: { role: "assistant", content: "Hi from the desk." } }],
          usage: { prompt_tokens: 8, completion_tokens: 4 },
        }),
        promptTokens: 8,
        completionTokens: 4,
        model: "gpt-4o-mini",
      }),
    });

    expect(result.text).toBe("Hi from the desk.");
    expect(result.spentCents).toBeGreaterThanOrEqual(1);
    expect(result.llmCents).toBe(before.spendableCents - result.spentCents);

    const [key] = await db.select().from(virtualKeys);
    expect(key?.spendUsedCents).toBeGreaterThan(0);
  });

  it("rejects a turn when no redeemed key exists", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await expect(
      handleDeskChat({
        userId,
        provider: "anthropic",
        model: "claude-haiku-4-5",
        messages: [{ role: "user", content: "Hello" }],
        db,
        forward: async () => {
          throw new Error("should_not_call");
        },
      }),
    ).rejects.toMatchObject({ name: "GatewayError", message: "redeem_required" } satisfies Partial<GatewayError>);
  });

  it("rejects a model that is not on the catalog", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db);
    await expect(
      handleDeskChat({
        userId,
        provider: "openai",
        model: "not-a-model",
        messages: [{ role: "user", content: "Hello" }],
        db,
        forward: async () => {
          throw new Error("should_not_call");
        },
      }),
    ).rejects.toMatchObject({ name: "GatewayError", message: "invalid_llm_model" });
  });
});
