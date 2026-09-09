import { z } from "zod";
import { MAX_USDG_REDEEM_CENTS } from "@/lib/redeem/limits";
import { STOCK_RAILS } from "@/lib/redeem/stock-catalog";
import { llmProviderSchema } from "@/lib/validation/llm";

export const railSchema = z.enum(["usdt", "llm_credits", ...STOCK_RAILS]);
export const namespaceSchema = z.enum(["eip155", "solana"]);

export const nonceRequestSchema = z.object({
  chainNamespace: namespaceSchema,
  address: z.string().min(32).max(64),
});

export const verifyRequestSchema = z.object({
  chainNamespace: namespaceSchema,
  address: z.string().min(32).max(64),
  message: z.string().min(20).max(4000),
  signature: z.string().min(64).max(200),
});

export const confirmSwapSchema = z.object({
  txHash: z.string().min(64).max(90),
  fromChain: z.string().min(1).max(32).regex(/^[a-z0-9-]+$/),
  toChain: z.string().min(1).max(32).regex(/^[a-z0-9-]+$/),
  fromToken: z.string().min(1).max(64),
  toToken: z.string().min(1).max(64),
  fromAmount: z.string().regex(/^[0-9]+(\.[0-9]+)?$/).max(40),
  toAmount: z.string().regex(/^[0-9]+(\.[0-9]+)?$/).max(40),
  notionalUsdCents: z.number().int().min(1).max(1_000_000_000),
  executedAt: z.string().datetime(),
  rail: railSchema.optional(),
});

export const quoteRequestSchema = z.object({
  fromChainId: z.number().int(),
  toChainId: z.number().int(),
  fromToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  toToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  fromAmount: z.string().regex(/^[0-9]+$/).max(78),
});

export const settleSwapSchema = z.object({
  provider: z.enum(["uniswap", "lifi", "changenow"]).optional(),
  txHash: z.string().min(64).max(90),
  fromChain: z.string().min(1).max(32),
  toChain: z.string().min(1).max(32),
  rail: railSchema.optional(),
  exchangeId: z.string().min(6).max(80).optional(),
  fromToken: z.string().optional(),
  toToken: z.string().optional(),
  notionalUsdCents: z.number().int().optional(),
});

export const changeNowCreateSchema = z.object({
  fromChainId: z.number().int(),
  toChainId: z.number().int(),
  fromToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  toToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  fromAmount: z.string().regex(/^[0-9]+$/).max(78),
});

export const importHashSchema = z.object({
  txHash: z.string().min(64).max(90),
  fromChain: z.string().min(1).max(32),
  toChain: z.string().min(1).max(32),
});

export const claimRequestSchema = z.object({
  rail: railSchema.optional(),
});

export const convertCreditsSchema = z.object({
  rail: railSchema,
  amountCents: z.number().int().min(1).max(10_000_000),
  idempotencyKey: z.string().min(8).max(80).regex(/^[A-Za-z0-9_-]+$/),
});

export const confirmOnChainClaimSchema = z.object({
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

export const redeemRequestSchema = z
  .object({
    rail: railSchema,
    amountCents: z.number().int().min(100).max(10_000_000),
    idempotencyKey: z.string().min(8).max(80).regex(/^[A-Za-z0-9_-]+$/),
    provider: llmProviderSchema.optional(),
    model: z.string().min(3).max(120).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.rail === "usdt" && data.amountCents > MAX_USDG_REDEEM_CENTS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "usdg_max_exceeded",
        path: ["amountCents"],
      });
    }
  });

export const chatCompletionSchema = z
  .object({
    model: z.string().min(1).max(120),
    messages: z.array(z.unknown()).min(1).max(200),
    stream: z.boolean().optional(),
  })
  .passthrough();

export const deskChatSchema = z.object({
  provider: llmProviderSchema,
  model: z.string().min(3).max(120),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(40),
});

export const anthropicMessagesSchema = z
  .object({
    model: z.string().min(1).max(80),
    max_tokens: z.number().int().min(1).max(200_000),
    messages: z.array(z.unknown()).min(1).max(200),
    stream: z.boolean().optional(),
    system: z.unknown().optional(),
  })
  .passthrough();

export const geminiGenerateSchema = z
  .object({
    contents: z.array(z.unknown()).min(1).max(200),
    systemInstruction: z.unknown().optional(),
    system_instruction: z.unknown().optional(),
    generationConfig: z.unknown().optional(),
    generation_config: z.unknown().optional(),
  })
  .passthrough();

export const rewardRuleSchema = z.object({
  conversionBps: z.number().int().min(25).max(100),
  minNotionalUsdCents: z.number().int().min(25_000).max(1_000_000_000),
  dailyCapUsdCents: z.number().int().min(100).max(10_000_000_000),
  enabled: z.boolean().default(true),
});

export const adminSessionSchema = z.object({
  secret: z.string().min(16).max(200),
});

export const flagResolveSchema = z.object({
  action: z.enum(["release", "reject"]),
});
