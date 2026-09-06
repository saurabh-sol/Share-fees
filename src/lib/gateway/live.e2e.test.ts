import { describe, expect, it } from "vitest";
import { GET as healthGet } from "@/app/api/v1/health/route";
import { createTestDb } from "@/lib/db/client";
import { payoutOutbox, users, wallets } from "@/lib/db/schema";
import { convertCredits } from "@/lib/ledger/convert";
import { postSwapReward } from "@/lib/ledger/post-swap-reward";
import { redeem } from "@/lib/redeem/service";
import type { LlmProvider } from "./catalog";
import { GatewayError, handleChatCompletion, handleListModels, handleMessages } from "./service";
import { providerReady } from "./providers";

const ADDRESS = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const PROBES: Array<{
  provider: LlmProvider;
  model: string;
  wrongModel: string;
}> = [
  { provider: "openai", model: "gpt-4o-mini", wrongModel: "claude-haiku-4-5" },
  { provider: "anthropic", model: "claude-haiku-4-5", wrongModel: "gpt-4o-mini" },
  { provider: "deepseek", model: "deepseek-chat", wrongModel: "gpt-4o-mini" },
];

const fill = {
  source: "mock" as const,
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
  id: string,
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

async function creditThenConvert(
  db: Awaited<ReturnType<typeof createTestDb>>,
  userId: string,
  rail: "usdt" | "llm_credits",
  txHash: string,
) {
  const posted = await postSwapReward({ ...fill, userId, txHash }, db);
  if (posted.creditedCents > 0) {
    await convertCredits(
      {
        userId,
        rail,
        amountCents: posted.creditedCents,
        idempotencyKey: `cnv_${txHash}`,
      },
      db,
    );
  }
  return posted;
}

function chatBody(model: string) {
  return {
    model,
    max_tokens: 16,
    messages: [{ role: "user", content: "Reply with the single word ok." }],
  };
}

describe("LLM gateway E2E — credit → redeem(provider) → t2c_ → gateway → pool key", () => {
  it("redeems one key per provider and probes models, chat, and error cases", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db, "user_gw_e2e");
    await creditThenConvert(db, userId, "llm_credits", `0x${"aa".repeat(32)}`);

    for (const probe of PROBES) {
      const issued = await redeem(
        {
          userId,
          address: ADDRESS,
          chainNamespace: "eip155",
          rail: "llm_credits",
          amountCents: 5,
          idempotencyKey: `idem_${probe.provider}`,
          provider: probe.provider,
          model: probe.model,
        },
        db,
      );
      expect(issued.alreadyExists).toBe(false);
      expect(issued.plaintextKey?.startsWith("t2c_")).toBe(true);
      const key = issued.plaintextKey!;
      const auth = `Bearer ${key}`;

      const listed = await handleListModels({ authorization: auth, db });
      expect(listed.object).toBe("list");
      expect(listed.data.length).toBeGreaterThan(0);
      expect(listed.data.every((item) => item.object === "model" && item.owned_by === probe.provider)).toBe(
        true,
      );
      expect(listed.data.every((item) => typeof item.created === "number")).toBe(true);
      expect(listed.data.some((item) => item.id === probe.model)).toBe(true);
      expect(listed.data.some((item) => item.id === probe.wrongModel)).toBe(false);

      await expect(
        handleChatCompletion({
          authorization: auth,
          body: chatBody(probe.wrongModel),
          db,
        }),
      ).rejects.toMatchObject({ message: "model_not_allowed", status: 400 } satisfies Partial<GatewayError>);

      await expect(
        handleChatCompletion({
          authorization: "Bearer sk-not-a-desk-key",
          body: chatBody(probe.model),
          db,
        }),
      ).rejects.toMatchObject({ message: "invalid_api_key", status: 401 } satisfies Partial<GatewayError>);

      await expect(
        handleChatCompletion({
          authorization: null,
          body: chatBody(probe.model),
          db,
        }),
      ).rejects.toMatchObject({ message: "invalid_api_key", status: 401 } satisfies Partial<GatewayError>);

      if (!providerReady(probe.provider)) {
        await expect(
          handleChatCompletion({
            authorization: auth,
            body: chatBody(probe.model),
            db,
          }),
        ).rejects.toMatchObject({
          message: "provider_pool_empty",
          status: 503,
        } satisfies Partial<GatewayError>);
        continue;
      }

      const live = await handleChatCompletion({
        authorization: auth,
        body: chatBody(probe.model),
        db,
      });
      expect(live.status).toBe(200);
      expect(live.headers.get("X-T2C-Provider")).toBe(probe.provider);
      const remaining = Number(live.headers.get("X-T2C-Remaining-Cents"));
      expect(remaining).toBeLessThan(5);
      expect(remaining).toBeGreaterThanOrEqual(0);

      const payload = (await live.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      expect(typeof payload.choices?.[0]?.message?.content).toBe("string");
      expect(payload.choices?.[0]?.message?.content?.length).toBeGreaterThan(0);

      if (remaining === 0) {
        await expect(
          handleChatCompletion({
            authorization: auth,
            body: chatBody(probe.model),
            db,
          }),
        ).rejects.toMatchObject({
          message: "insufficient_credits",
          status: 402,
        } satisfies Partial<GatewayError>);
      }
    }
  }, 90_000);

  it("returns 402 after a one-cent key is spent", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db, "user_gw_e2e_402");
    await creditThenConvert(db, userId, "llm_credits", `0x${"bb".repeat(32)}`);
    const issued = await redeem(
      {
        userId,
        address: ADDRESS,
        chainNamespace: "eip155",
        rail: "llm_credits",
        amountCents: 1,
        idempotencyKey: "idem_drain",
        provider: "openai",
        model: "gpt-4o-mini",
      },
      db,
    );

    const first = await handleChatCompletion({
      authorization: `Bearer ${issued.plaintextKey}`,
      body: chatBody("gpt-4o-mini"),
      db,
      forward: async () => ({
        response: Response.json({
          id: "chat_drain",
          choices: [{ message: { role: "assistant", content: "ok" } }],
        }),
        promptTokens: 8,
        completionTokens: 1,
        model: "gpt-4o-mini",
      }),
    });
    expect(first.status).toBe(200);
    expect(first.headers.get("X-T2C-Remaining-Cents")).toBe("0");
    const shaped = (await first.json()) as { object?: string; choices?: unknown[]; usage?: { total_tokens?: number } };
    expect(shaped.object).toBe("chat.completion");
    expect(Array.isArray(shaped.choices)).toBe(true);
    expect(typeof shaped.usage?.total_tokens).toBe("number");

    await expect(
      handleChatCompletion({
        authorization: `Bearer ${issued.plaintextKey}`,
        body: chatBody("gpt-4o-mini"),
        db,
        forward: async () => {
          throw new Error("should_not_forward");
        },
      }),
    ).rejects.toMatchObject({ message: "insufficient_credits", status: 402 } satisfies Partial<GatewayError>);
  });

  it("serves the official Anthropic messages API only for Claude keys", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db, "user_gw_e2e_messages");
    await creditThenConvert(db, userId, "llm_credits", `0x${"ee".repeat(32)}`);
    const claude = await redeem(
      {
        userId,
        address: ADDRESS,
        chainNamespace: "eip155",
        rail: "llm_credits",
        amountCents: 5,
        idempotencyKey: "idem_msg_claude",
        provider: "anthropic",
        model: "claude-haiku-4-5",
      },
      db,
    );
    const openai = await redeem(
      {
        userId,
        address: ADDRESS,
        chainNamespace: "eip155",
        rail: "llm_credits",
        amountCents: 5,
        idempotencyKey: "idem_msg_openai",
        provider: "openai",
        model: "gpt-4o-mini",
      },
      db,
    );

    await expect(
      handleMessages({
        authorization: `Bearer ${openai.plaintextKey}`,
        body: {
          model: "claude-haiku-4-5",
          max_tokens: 16,
          messages: [{ role: "user", content: "Hello" }],
        },
        db,
      }),
    ).rejects.toMatchObject({ message: "provider_api_mismatch", status: 400 } satisfies Partial<GatewayError>);

    const response = await handleMessages({
      authorization: `Bearer ${claude.plaintextKey}`,
      body: {
        model: "claude-haiku-4-5",
        max_tokens: 16,
        messages: [{ role: "user", content: "Hello" }],
      },
      db,
      forward: async () => ({
        response: Response.json({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "claude-haiku-4-5",
          content: [{ type: "text", text: "ok" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 6, output_tokens: 2 },
        }),
        promptTokens: 6,
        completionTokens: 2,
        model: "claude-haiku-4-5",
      }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("X-T2C-Provider")).toBe("anthropic");
    const body = (await response.json()) as { type?: string; content?: Array<{ text?: string }> };
    expect(body.type).toBe("message");
    expect(body.content?.[0]?.text).toBe("ok");
  });

  it("queues USDT to the session EVM address only", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db, "user_gw_e2e_usdt");
    await creditThenConvert(db, userId, "usdt", `0x${"cc".repeat(32)}`);
    const result = await redeem(
      {
        userId,
        address: ADDRESS,
        chainNamespace: "eip155",
        rail: "usdt",
        amountCents: 50,
        idempotencyKey: "idem_usdt_e2e",
      },
      db,
    );
    expect(result.status).toBe("queued");
    const [outbox] = await db.select().from(payoutOutbox);
    expect(outbox?.destination).toBe(ADDRESS);
    expect(outbox?.txHash).toBeNull();

    await expect(
      redeem(
        {
          userId,
          address: ADDRESS,
          chainNamespace: "solana",
          rail: "usdt",
          amountCents: 10,
          idempotencyKey: "idem_usdt_sol",
        },
        db,
      ),
    ).rejects.toMatchObject({ message: "usdt_evm_only" });
  });

  it("refuses to credit the same (tx, chain) twice", async () => {
    const db = await createTestDb();
    const userId = await seedUser(db, "user_gw_e2e_hash");
    const txHash = `0x${"dd".repeat(32)}`;
    const first = await postSwapReward({ ...fill, userId, txHash }, db);
    expect(first.alreadyExists).toBe(false);
    expect(first.creditedCents).toBeGreaterThan(0);
    const replay = await postSwapReward({ ...fill, userId, txHash }, db);
    expect(replay.alreadyExists).toBe(true);
    expect(replay.creditedCents).toBe(0);
  });

  it("health reports database (and Redis only when required)", async () => {
    const response = await healthGet();
    const body = (await response.json()) as {
      ok: boolean;
      database: boolean;
      redis: boolean;
    };
    expect(body.database).toBe(true);
    expect(response.status === 200 || response.status === 503).toBe(true);
    if (process.env.NODE_ENV === "production") {
      expect(body.redis).toBe(true);
      expect(body.ok).toBe(true);
    } else {
      expect(body.ok).toBe(body.database);
    }
  });
});
