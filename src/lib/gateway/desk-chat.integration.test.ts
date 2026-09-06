import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { ledgerEntries, users, wallets } from "@/lib/db/schema";
import { postSwapReward } from "@/lib/ledger/post-swap-reward";
import { spendableLlmCents } from "@/lib/ledger/desk-chat";
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
  it("converts website credit, calls the model, and charges at least one cent", async () => {
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
    expect(before.llmCents).toBe(0);

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
    expect(result.creditCents + result.llmCents).toBe(before.spendableCents - result.spentCents);

    const spendLegs = (await db.select().from(ledgerEntries)).filter(
      (row) => row.referenceType === "desk_chat",
    );
    expect(spendLegs.some((row) => row.account === "rewards_expense" && row.type === "credit")).toBe(
      true,
    );
  });

  it("holds remaining credit so a second turn cannot spend past the wallet", async () => {
    const db = await createTestDb();
    const userId = "user_desk_chat_hold";
    await db.insert(users).values({
      id: userId,
      chainNamespace: "eip155",
      address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    await db.insert(wallets).values({
      userId,
      creditCacheCents: 0,
      usdtCacheCents: 0,
      llmCacheCents: 0,
    });
    await db.insert(ledgerEntries).values([
      {
        id: "led_seed_credit",
        userId,
        account: "user_credits",
        type: "credit",
        amountCents: 1,
        referenceType: "swap",
        referenceId: "swp_seed",
      },
      {
        id: "led_seed_exp",
        userId,
        account: "rewards_expense",
        type: "debit",
        amountCents: 1,
        referenceType: "swap",
        referenceId: "swp_seed",
      },
    ]);

    const first = handleDeskChat({
      userId,
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hello" }],
      db,
      forward: async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return {
          response: Response.json({
            id: "chat_hold",
            choices: [{ message: { role: "assistant", content: "Held." } }],
            usage: { prompt_tokens: 4, completion_tokens: 2 },
          }),
          promptTokens: 4,
          completionTokens: 2,
          model: "gpt-4o-mini",
        };
      },
    });
    const second = handleDeskChat({
      userId,
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Again" }],
      db,
      forward: async () => {
        throw new Error("should_not_call");
      },
    });

    const settled = await Promise.allSettled([first, second]);
    const ok = settled.filter((item) => item.status === "fulfilled");
    const blocked = settled.filter((item) => item.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(blocked).toHaveLength(1);
    if (blocked[0]?.status === "rejected") {
      expect(blocked[0].reason).toMatchObject({ message: "insufficient_credits" });
    }
    const after = await spendableLlmCents(userId, db);
    expect(after.spendableCents).toBe(0);
  });

  it("rejects a turn when the wallet has no credit", async () => {
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
    ).rejects.toMatchObject({ name: "GatewayError", message: "insufficient_credits" } satisfies Partial<GatewayError>);
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
