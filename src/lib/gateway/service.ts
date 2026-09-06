import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { virtualKeys } from "@/lib/db/schema";
import { hashVirtualKey } from "@/lib/redeem/keys";
import { rateLimitOrThrow } from "@/lib/security/rate-limit";
import { anthropicMessagesSchema, chatCompletionSchema } from "@/lib/validation/swap";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROVIDER,
  allGatewayModels,
  assertProviderModel,
  estimateUsageCents,
  isLlmProvider,
  modelsForProvider,
  type LlmProvider,
} from "./catalog";
import { GatewayError } from "./errors";
import { reshapeAnthropicMessage } from "./anthropic";
import { reshapeProviderCompletion, toOpenAiModel } from "./openai";
import { type ChatForwarder, forwardAnthropicMessages, forwarderFor } from "./providers";

export { GatewayError } from "./errors";
export { estimateUsageCents } from "./catalog";
export const GATEWAY_MODELS = allGatewayModels().map((item) => item.id);

/**
 * Working map — do not invert:
 * credit (50 bps) → convert 1:1 to LLM rail → redeem(provider, model)
 * → t2c_ plaintext shown once → official provider APIs
 *    OpenAI / DeepSeek: POST {origin}/v1/chat/completions
 *    Anthropic: POST {origin}/v1/messages (x-api-key)
 *    Models: GET {origin}/v1/models
 * → hash lookup + spend cap → pool key for that provider → settle cents.
 * The client never sees OPENAI_ / ANTHROPIC_ / DEEPSEEK_API_KEY.
 */

type Db = Awaited<ReturnType<typeof getDb>>;

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

function providerOf(row: { provider?: string | null }): LlmProvider {
  const value = row.provider ?? DEFAULT_LLM_PROVIDER;
  return isLlmProvider(value) ? value : DEFAULT_LLM_PROVIDER;
}

export async function authenticateVirtualKey(raw: string, db?: Db): Promise<
  typeof virtualKeys.$inferSelect & { remainingCents: number; provider: LlmProvider }
> {
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
  const provider = providerOf(row);
  return { ...row, remainingCents, provider };
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

async function reserveVirtualKey(keyId: string, db: Db) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM virtual_keys WHERE id = ${keyId} FOR UPDATE`);
    const [row] = await tx.select().from(virtualKeys).where(eq(virtualKeys.id, keyId)).limit(1);
    if (!row || row.status !== "active") {
      throw new GatewayError("invalid_api_key", 401);
    }
    const remaining = row.spendCapCents - row.spendUsedCents;
    if (remaining <= 0) {
      throw new GatewayError("insufficient_credits", 402);
    }
    await tx
      .update(virtualKeys)
      .set({ spendUsedCents: row.spendCapCents })
      .where(eq(virtualKeys.id, keyId));
    return { usedBefore: row.spendUsedCents, cap: row.spendCapCents };
  });
}

async function settleReservation(
  keyId: string,
  usedBefore: number,
  cap: number,
  actualCents: number,
  db: Db,
) {
  const nextUsed = Math.min(usedBefore + Math.max(0, actualCents), cap);
  await db.update(virtualKeys).set({ spendUsedCents: nextUsed }).where(eq(virtualKeys.id, keyId));
  return cap - nextUsed;
}

async function releaseReservation(keyId: string, usedBefore: number, db: Db) {
  await db.update(virtualKeys).set({ spendUsedCents: usedBefore }).where(eq(virtualKeys.id, keyId));
}

function resolveRequestModel(provider: LlmProvider, keyModel: string, requested: unknown) {
  const fallback = keyModel || DEFAULT_LLM_MODEL;
  const model = typeof requested === "string" && requested.length > 0 ? requested : fallback;
  try {
    return assertProviderModel(provider, model).model;
  } catch {
    throw new GatewayError("model_not_allowed", 400);
  }
}

export async function handleListModels(input: { authorization: string | null; db?: Db }) {
  const raw = readBearerToken(input.authorization);
  const key = await authenticateVirtualKey(raw, input.db);
  return {
    object: "list" as const,
    data: modelsForProvider(key.provider).map((item) => toOpenAiModel(item.id, key.provider)),
  };
}

export async function handleRetrieveModel(input: {
  authorization: string | null;
  modelId: string;
  db?: Db;
}) {
  const listed = await handleListModels(input);
  const match = listed.data.find((item) => item.id === input.modelId);
  if (!match) {
    throw new GatewayError("model_not_found", 404);
  }
  return match;
}

export async function handleChatCompletion(input: {
  authorization: string | null;
  body: unknown;
  forward?: ChatForwarder;
  db?: Db;
}) {
  const raw = readBearerToken(input.authorization);
  const key = await authenticateVirtualKey(raw, input.db);
  await rateLimitOrThrow(`gateway:${key.keyHash}`, 30, 60_000);
  await rateLimitOrThrow(`gateway:${key.provider}:${key.keyHash}`, 20, 60_000);

  const parsed = chatCompletionSchema.parse(input.body);
  if (parsed.stream) {
    throw new GatewayError("stream_not_supported", 400);
  }

  const provider = key.provider;
  const model = resolveRequestModel(provider, key.model ?? DEFAULT_LLM_MODEL, parsed.model);
  const routedBody = { ...parsed, model };

  const client = input.db ?? (await getDb());
  const reservation = await reserveVirtualKey(key.id, client);
  try {
    const forward = input.forward ?? forwarderFor(provider);
    const result = await forward({ body: routedBody });
    const used = estimateUsageCents({
      provider,
      model: result.model || model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });
    const remainingCents = await settleReservation(
      key.id,
      reservation.usedBefore,
      reservation.cap,
      used,
      client,
    );

    const raw = (await result.response.json()) as unknown;
    const shaped = reshapeProviderCompletion(raw, result.model || model);
    const headers = new Headers({ "content-type": "application/json" });
    headers.set("X-T2C-Remaining-Cents", String(remainingCents));
    headers.set("X-T2C-Provider", provider);
    headers.set("X-T2C-Spend-Cap-Cents", String(reservation.cap));
    return Response.json(shaped, {
      status: 200,
      headers,
    });
  } catch (error) {
    await releaseReservation(key.id, reservation.usedBefore, client);
    throw error;
  }
}

export async function handleMessages(input: {
  authorization: string | null;
  body: unknown;
  forward?: ChatForwarder;
  db?: Db;
}) {
  const raw = readBearerToken(input.authorization);
  const key = await authenticateVirtualKey(raw, input.db);
  if (key.provider !== "anthropic") {
    throw new GatewayError("provider_api_mismatch", 400);
  }
  await rateLimitOrThrow(`gateway:${key.keyHash}`, 30, 60_000);
  await rateLimitOrThrow(`gateway:${key.provider}:${key.keyHash}`, 20, 60_000);

  const parsed = anthropicMessagesSchema.parse(input.body);
  if (parsed.stream) {
    throw new GatewayError("stream_not_supported", 400);
  }

  const model = resolveRequestModel("anthropic", key.model ?? "claude-haiku-4-5", parsed.model);
  const routedBody = { ...parsed, model };
  const client = input.db ?? (await getDb());
  const reservation = await reserveVirtualKey(key.id, client);
  try {
    const forward = input.forward ?? forwardAnthropicMessages;
    const result = await forward({ body: routedBody });
    const used = estimateUsageCents({
      provider: "anthropic",
      model: result.model || model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });
    const remainingCents = await settleReservation(
      key.id,
      reservation.usedBefore,
      reservation.cap,
      used,
      client,
    );
    const payload = reshapeAnthropicMessage(await result.response.json(), result.model || model);
    const headers = new Headers({ "content-type": "application/json" });
    headers.set("X-T2C-Remaining-Cents", String(remainingCents));
    headers.set("X-T2C-Provider", "anthropic");
    headers.set("X-T2C-Spend-Cap-Cents", String(reservation.cap));
    return Response.json(payload, { status: 200, headers });
  } catch (error) {
    await releaseReservation(key.id, reservation.usedBefore, client);
    throw error;
  }
}

export class AiGateway {
  authenticateVirtualKey = authenticateVirtualKey;
  consumeVirtualKey = consumeVirtualKey;
  handleListModels = handleListModels;
  handleRetrieveModel = handleRetrieveModel;
  handleChatCompletion = handleChatCompletion;
  handleMessages = handleMessages;
}
