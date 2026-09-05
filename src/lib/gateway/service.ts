import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { virtualKeys } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { hashVirtualKey } from "@/lib/redeem/keys";
import { rateLimitOrThrow } from "@/lib/security/rate-limit";
import { chatCompletionSchema } from "@/lib/validation/swap";

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "GatewayError";
  }
}

type Db = Awaited<ReturnType<typeof getDb>>;

const MODEL_RATES: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4o": { in: 2.5, out: 10 },
};

export const GATEWAY_MODELS = ["gpt-4o-mini", "gpt-4o"] as const;

export function estimateUsageCents(input: {
  model: string;
  promptTokens: number;
  completionTokens: number;
}) {
  const rate = MODEL_RATES[input.model] ?? MODEL_RATES["gpt-4o-mini"];
  const dollars =
    (input.promptTokens * rate.in) / 1_000_000 + (input.completionTokens * rate.out) / 1_000_000;
  return Math.max(1, Math.ceil(dollars * 100));
}

export function readBearerToken(header: string | null) {
  if (!header?.startsWith("Bearer ")) {
    throw new GatewayError("invalid_api_key", 401);
  }
  const token = header.slice(7).trim();
  if (!token) {
    throw new GatewayError("invalid_api_key", 401);
  }
  return token;
}

export async function authenticateVirtualKey(raw: string, db?: Db) {
  if (!raw.startsWith("t2c_")) {
    throw new GatewayError("invalid_api_key", 401);
  }
  const client = db ?? (await getDb());
  const [row] = await client
    .select()
    .from(virtualKeys)
    .where(eq(virtualKeys.keyHash, hashVirtualKey(raw)))
    .limit(1);
  if (!row || row.status !== "active") {
    throw new GatewayError("invalid_api_key", 401);
  }
  const remainingCents = row.spendCapCents - row.spendUsedCents;
  if (remainingCents <= 0) {
    throw new GatewayError("insufficient_credits", 402);
  }
  return { ...row, remainingCents };
}

export async function consumeVirtualKey(keyId: string, cents: number, db?: Db) {
  const client = db ?? (await getDb());
  const [row] = await client.select().from(virtualKeys).where(eq(virtualKeys.id, keyId)).limit(1);
  if (!row || row.status !== "active") {
    throw new GatewayError("invalid_api_key", 401);
  }
  const nextUsed = Math.min(row.spendUsedCents + Math.max(0, cents), row.spendCapCents);
  await client
    .update(virtualKeys)
    .set({ spendUsedCents: nextUsed })
    .where(and(eq(virtualKeys.id, keyId), eq(virtualKeys.status, "active")));
  return row.spendCapCents - nextUsed;
}

export type ChatForwarder = (input: {
  body: unknown;
  signal?: AbortSignal;
}) => Promise<{
  response: Response;
  promptTokens: number;
  completionTokens: number;
  model: string;
}>;

export const forwardToOpenAI: ChatForwarder = async ({ body, signal }) => {
  if (!env.openaiApiKey) {
    throw new GatewayError("provider_pool_empty", 503);
  }
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.openaiApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  const json = (await response.json()) as {
    model?: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new GatewayError(json.error?.message ?? "provider_error", 502);
  }
  return {
    response: Response.json(json),
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
    model: json.model ?? "gpt-4o-mini",
  };
};

export async function handleChatCompletion(input: {
  authorization: string | null;
  body: unknown;
  forward?: ChatForwarder;
  db?: Db;
}) {
  const raw = readBearerToken(input.authorization);
  const key = await authenticateVirtualKey(raw, input.db);
  rateLimitOrThrow(`gateway:${key.keyHash}`, 60, 60_000);

  const parsed = chatCompletionSchema.parse(input.body);
  if (parsed.stream) {
    throw new GatewayError("stream_not_supported", 400);
  }

  const forward = input.forward ?? forwardToOpenAI;
  const result = await forward({ body: parsed });
  const used = estimateUsageCents({
    model: result.model,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
  });
  const remainingCents = await consumeVirtualKey(key.id, used, input.db);

  const headers = new Headers(result.response.headers);
  headers.set("X-T2C-Remaining-Cents", String(remainingCents));
  return new Response(result.response.body, {
    status: result.response.status,
    headers,
  });
}

export class AiGateway {
  authenticateVirtualKey = authenticateVirtualKey;
  consumeVirtualKey = consumeVirtualKey;
  handleChatCompletion = handleChatCompletion;
}
