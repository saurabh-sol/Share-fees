import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { virtualKeys } from "@/lib/db/schema";
import { hashVirtualKey } from "@/lib/redeem/keys";
import {
  isVirtualKey,
  RESPONSE_HEADER_PROVIDER,
  RESPONSE_HEADER_REMAINING,
  RESPONSE_HEADER_SPEND_CAP,
} from "@/lib/brand";
import { rateLimitOrThrow } from "@/lib/security/rate-limit";
import { recordX402Settlement } from "@/lib/x402/settle";
import { x402ModelsList } from "@/lib/x402/discovery";
import { anthropicMessagesSchema, chatCompletionSchema, geminiGenerateSchema } from "@/lib/validation/swap";
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
import type { GatewayAuthContext } from "@/lib/x402/types";
import { GatewayError } from "./errors";
import { reshapeAnthropicMessage } from "./anthropic";
import { geminiToChatBody, reshapeGeminiContent } from "./gemini";
import { reshapeProviderCompletion, toOpenAiModel } from "./openai";
import { type ChatForwarder, forwardAnthropicMessages, forwarderFor } from "./providers";

export { GatewayError } from "./errors";
export { estimateUsageCents } from "./catalog";
export const GATEWAY_MODELS = allGatewayModels().map((item) => item.id);

/**
 * Working map — do not invert:
 * credit (50 bps) → convert 1:1 to LLM rail → redeem(provider, model)
 * → acc_ plaintext shown once → official provider APIs
 *    OpenAI / DeepSeek / Google: POST {origin}/v1/chat/completions
 *    Google OpenAI-compat: POST {origin}/v1beta/openai/chat/completions
 *    Google native: POST {origin}/v1beta/models/{model}:generateContent (x-goog-api-key)
 *    Anthropic: POST {origin}/v1/messages (x-api-key)
 *    Models: GET {origin}/v1/models
 * → hash lookup + spend cap → Vercel AI Gateway (or a leftover provider pool
 *    key) → settle cents. The client never sees upstream credentials.
 *
 * Dual rail: acc_ keys OR x402 USDG pay-per-request when X402_ENABLED.
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
  if (!isVirtualKey(raw)) {
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

export async function findActiveVirtualKey(
  userId: string,
  provider: LlmProvider,
  model: string,
  db?: Db,
) {
  const client = db ?? (await getDb());
  const rows = await client
    .select()
    .from(virtualKeys)
    .where(and(eq(virtualKeys.userId, userId), eq(virtualKeys.status, "active"), eq(virtualKeys.provider, provider)));
  const usable = rows
    .map((row) => ({
      ...row,
      remainingCents: row.spendCapCents - row.spendUsedCents,
      provider: providerOf(row),
    }))
    .filter((row) => row.remainingCents > 0);
  if (usable.length === 0) return null;
  return usable.find((row) => row.model === model) ?? usable[0] ?? null;
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

export async function reserveVirtualKey(keyId: string, db: Db) {
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

export async function settleVirtualKeyReservation(
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

export async function releaseVirtualKeyReservation(keyId: string, usedBefore: number, db: Db) {
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

function rateLimitKey(auth: GatewayAuthContext) {
  if (auth.mode === "virtualKey") {
    return `gateway:${auth.key.keyHash}`;
  }
  return `gateway:x402:${auth.payer.toLowerCase()}`;
}

export async function handleListModels(input: {
  auth: GatewayAuthContext | null;
  db?: Db;
}) {
  if (!input.auth || input.auth.mode === "x402") {
    return x402ModelsList();
  }
  const provider = input.auth.key.provider;
  return {
    object: "list" as const,
    data: modelsForProvider(provider).map((item) => toOpenAiModel(item.id, provider)),
  };
}

export async function handleRetrieveModel(input: {
  auth: GatewayAuthContext | null;
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
  auth: GatewayAuthContext;
  body: unknown;
  forward?: ChatForwarder;
  db?: Db;
  requestId?: string;
}) {
  const auth = input.auth;
  await rateLimitOrThrow(rateLimitKey(auth), 30, 60_000);
  if (auth.mode === "virtualKey") {
    await rateLimitOrThrow(`gateway:${auth.key.provider}:${auth.key.keyHash}`, 20, 60_000);
  }

  const parsed = chatCompletionSchema.parse(input.body);
  if (parsed.stream) {
    throw new GatewayError("stream_not_supported", 400);
  }

  const provider = auth.mode === "virtualKey" ? auth.key.provider : auth.provider;
  const keyModel =
    auth.mode === "virtualKey" ? (auth.key.model ?? DEFAULT_LLM_MODEL) : auth.model;
  const model = resolveRequestModel(provider, keyModel, parsed.model);
  const routedBody = { ...parsed, model };

  const client = input.db ?? (await getDb());

  if (auth.mode === "x402") {
    const forward = input.forward ?? forwarderFor(provider);
    const result = await forward({ body: routedBody });
    const used = estimateUsageCents({
      provider,
      model: result.model || model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });
    await recordX402Settlement(
      {
        requestId: input.requestId ?? crypto.randomUUID(),
        payer: auth.payer,
        txHash: auth.txHash,
        amountUsdg: auth.maxPriceUsdg,
        model: result.model || model,
        provider,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        actualCents: used,
      },
      client,
    );
    const shaped = reshapeProviderCompletion(await result.response.json(), result.model || model);
    const headers = new Headers({ "content-type": "application/json" });
    for (const [key, value] of Object.entries(auth.responseHeaders)) {
      headers.set(key, value);
    }
    headers.set(RESPONSE_HEADER_PROVIDER, provider);
    return Response.json(shaped, { status: 200, headers });
  }

  const reservation = await reserveVirtualKey(auth.key.id, client);
  try {
    const forward = input.forward ?? forwarderFor(provider);
    const result = await forward({ body: routedBody });
    const used = estimateUsageCents({
      provider,
      model: result.model || model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });
    const remainingCents = await settleVirtualKeyReservation(
      auth.key.id,
      reservation.usedBefore,
      reservation.cap,
      used,
      client,
    );

    const raw = (await result.response.json()) as unknown;
    const shaped = reshapeProviderCompletion(raw, result.model || model);
    const headers = new Headers({ "content-type": "application/json" });
    headers.set(RESPONSE_HEADER_REMAINING, String(remainingCents));
    headers.set(RESPONSE_HEADER_PROVIDER, provider);
    headers.set(RESPONSE_HEADER_SPEND_CAP, String(reservation.cap));
    return Response.json(shaped, {
      status: 200,
      headers,
    });
  } catch (error) {
    await releaseVirtualKeyReservation(auth.key.id, reservation.usedBefore, client);
    throw error;
  }
}

export async function handleMessages(input: {
  auth: GatewayAuthContext;
  body: unknown;
  forward?: ChatForwarder;
  db?: Db;
  requestId?: string;
}) {
  const auth = input.auth;
  const provider = auth.mode === "virtualKey" ? auth.key.provider : auth.provider;
  if (provider !== "anthropic") {
    throw new GatewayError("provider_api_mismatch", 400);
  }
  await rateLimitOrThrow(rateLimitKey(auth), 30, 60_000);
  if (auth.mode === "virtualKey") {
    await rateLimitOrThrow(`gateway:anthropic:${auth.key.keyHash}`, 20, 60_000);
  }

  const parsed = anthropicMessagesSchema.parse(input.body);
  if (parsed.stream) {
    throw new GatewayError("stream_not_supported", 400);
  }

  const keyModel =
    auth.mode === "virtualKey" ? (auth.key.model ?? "claude-haiku-4-5") : auth.model;
  const model = resolveRequestModel("anthropic", keyModel, parsed.model);
  const routedBody = { ...parsed, model };
  const client = input.db ?? (await getDb());

  if (auth.mode === "x402") {
    const forward = input.forward ?? forwardAnthropicMessages;
    const result = await forward({ body: routedBody });
    const used = estimateUsageCents({
      provider: "anthropic",
      model: result.model || model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });
    await recordX402Settlement(
      {
        requestId: input.requestId ?? crypto.randomUUID(),
        payer: auth.payer,
        txHash: auth.txHash,
        amountUsdg: auth.maxPriceUsdg,
        model: result.model || model,
        provider: "anthropic",
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        actualCents: used,
      },
      client,
    );
    const payload = reshapeAnthropicMessage(await result.response.json(), result.model || model);
    const headers = new Headers({ "content-type": "application/json" });
    for (const [key, value] of Object.entries(auth.responseHeaders)) {
      headers.set(key, value);
    }
    headers.set(RESPONSE_HEADER_PROVIDER, "anthropic");
    return Response.json(payload, { status: 200, headers });
  }

  const reservation = await reserveVirtualKey(auth.key.id, client);
  try {
    const forward = input.forward ?? forwardAnthropicMessages;
    const result = await forward({ body: routedBody });
    const used = estimateUsageCents({
      provider: "anthropic",
      model: result.model || model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });
    const remainingCents = await settleVirtualKeyReservation(
      auth.key.id,
      reservation.usedBefore,
      reservation.cap,
      used,
      client,
    );
    const payload = reshapeAnthropicMessage(await result.response.json(), result.model || model);
    const headers = new Headers({ "content-type": "application/json" });
    headers.set(RESPONSE_HEADER_REMAINING, String(remainingCents));
    headers.set(RESPONSE_HEADER_PROVIDER, "anthropic");
    headers.set(RESPONSE_HEADER_SPEND_CAP, String(reservation.cap));
    return Response.json(payload, { status: 200, headers });
  } catch (error) {
    await releaseVirtualKeyReservation(auth.key.id, reservation.usedBefore, client);
    throw error;
  }
}

export async function handleGenerateContent(input: {
  auth: GatewayAuthContext;
  model: string;
  body: unknown;
  forward?: ChatForwarder;
  db?: Db;
  requestId?: string;
}) {
  const auth = input.auth;
  const provider = auth.mode === "virtualKey" ? auth.key.provider : auth.provider;
  if (provider !== "google") {
    throw new GatewayError("provider_api_mismatch", 400);
  }
  const parsed = geminiGenerateSchema.parse(input.body);
  const keyModel = auth.mode === "virtualKey" ? (auth.key.model ?? DEFAULT_LLM_MODEL) : auth.model;
  const model = resolveRequestModel("google", keyModel, input.model);
  const routed = geminiToChatBody(model, parsed);
  if (routed.messages.length === 0) {
    throw new GatewayError("invalid_body", 400);
  }
  const response = await handleChatCompletion({
    auth,
    body: routed,
    forward: input.forward,
    db: input.db,
    requestId: input.requestId,
  });
  const headers = new Headers(response.headers);
  const payload = reshapeGeminiContent(await response.json(), model);
  return Response.json(payload, { status: response.status, headers });
}

export class AiGateway {
  authenticateVirtualKey = authenticateVirtualKey;
  consumeVirtualKey = consumeVirtualKey;
  handleListModels = handleListModels;
  handleRetrieveModel = handleRetrieveModel;
  handleChatCompletion = handleChatCompletion;
  handleMessages = handleMessages;
  handleGenerateContent = handleGenerateContent;
}
