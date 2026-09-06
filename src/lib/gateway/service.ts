import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { virtualKeys } from "@/lib/db/schema";
import { hashVirtualKey } from "@/lib/redeem/keys";
import { rateLimitOrThrow } from "@/lib/security/rate-limit";
import { chatCompletionSchema } from "@/lib/validation/swap";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROVIDER,
  allGatewayModels,
  assertProviderModel,
  estimateUsageCents,
  isLlmProvider,
  type LlmProvider,
} from "./catalog";
import { GatewayError } from "./errors";
import { type ChatForwarder, forwarderFor } from "./providers";

export { GatewayError } from "./errors";
export { estimateUsageCents } from "./catalog";
export const GATEWAY_MODELS = allGatewayModels().map((item) => item.id);

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

    const headers = new Headers(result.response.headers);
    headers.set("X-T2C-Remaining-Cents", String(remainingCents));
    headers.set("X-T2C-Provider", provider);
    headers.set("X-T2C-Spend-Cap-Cents", String(reservation.cap));
    return new Response(result.response.body, {
      status: result.response.status,
      headers,
    });
  } catch (error) {
    await releaseReservation(key.id, reservation.usedBefore, client);
    throw error;
  }
}

export class AiGateway {
  authenticateVirtualKey = authenticateVirtualKey;
  consumeVirtualKey = consumeVirtualKey;
  handleChatCompletion = handleChatCompletion;
}
