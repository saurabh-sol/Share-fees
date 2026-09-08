import { env } from "@/lib/env";
import { BRAND_NAME } from "@/lib/brand";
import { ChangeNowError, type ChangeNowCurrency, type ChangeNowEstimate, type ChangeNowExchange } from "./types";

const CHANGE_NOW_BASE = "https://api.changenow.io/v2";

type CacheEntry<T> = { value: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();

function readCache<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit || hit.expiresAt <= Date.now()) return null;
  return hit.value as T;
}

function writeCache<T>(key: string, value: T, ttlMs: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function headers(json = false): Record<string, string> {
  const next: Record<string, string> = { accept: "application/json" };
  if (json) next["content-type"] = "application/json";
  if (env.changeNowApiKey) {
    next["x-changenow-api-key"] = env.changeNowApiKey;
  }
  return next;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

async function nowGet<T>(path: string, params: Record<string, string>, ttlMs = 0): Promise<T> {
  const url = new URL(`${CHANGE_NOW_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const cacheKey = url.toString();
  if (ttlMs > 0) {
    const cached = readCache<T>(cacheKey);
    if (cached) return cached;
  }

  const response = await fetch(url, {
    headers: headers(),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { message: text };
  }
  if (!response.ok) {
    const body = asRecord(parsed);
    throw new ChangeNowError(
      asString(body.message) ?? asString(body.error) ?? `changenow_${response.status}`,
      response.status >= 400 && response.status < 500 ? response.status : 502,
    );
  }
  if (ttlMs > 0) writeCache(cacheKey, parsed as T, ttlMs);
  return parsed as T;
}

export async function fetchChangeNowCurrencies(): Promise<ChangeNowCurrency[]> {
  const data = await nowGet<ChangeNowCurrency[]>(
    "/exchange/currencies",
    { active: "true", flow: "standard" },
    10 * 60 * 1000,
  );
  return Array.isArray(data) ? data : [];
}

function legacyTicker(ticker: string, network: string, explicit?: string) {
  if (explicit) return explicit;
  return network && network !== ticker ? `${ticker}${network}` : ticker;
}

async function fetchChangeNowEstimateV1(input: {
  fromLegacy: string;
  toLegacy: string;
  fromAmount: string;
}) {
  const url = new URL(
    `https://api.changenow.io/v1/exchange-amount/${encodeURIComponent(input.fromAmount)}/${input.fromLegacy}_${input.toLegacy}`,
  );
  const response = await fetch(url, {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const raw = asRecord(await response.json().catch(() => ({})));
  if (!response.ok) {
    throw new ChangeNowError(
      asString(raw.message) ?? asString(raw.error) ?? `changenow_${response.status}`,
      response.status >= 400 && response.status < 500 ? response.status : 502,
    );
  }
  return raw;
}

export async function fetchChangeNowEstimate(input: {
  fromCurrency: string;
  toCurrency: string;
  fromNetwork: string;
  toNetwork: string;
  fromAmount: string;
  fromLegacy?: string;
  toLegacy?: string;
}): Promise<ChangeNowEstimate> {
  let raw: Record<string, unknown> = {};
  const v1 = () =>
    fetchChangeNowEstimateV1({
      fromLegacy: legacyTicker(input.fromCurrency, input.fromNetwork, input.fromLegacy),
      toLegacy: legacyTicker(input.toCurrency, input.toNetwork, input.toLegacy),
      fromAmount: input.fromAmount,
    });
  if (env.changeNowApiKey) {
    try {
      raw = asRecord(
        await nowGet<unknown>("/exchange/estimated-amount", {
          fromCurrency: input.fromCurrency,
          toCurrency: input.toCurrency,
          fromNetwork: input.fromNetwork,
          toNetwork: input.toNetwork,
          fromAmount: input.fromAmount,
          flow: "standard",
          type: "direct",
        }),
      );
    } catch {
      raw = await v1();
    }
  } else {
    raw = await v1();
  }
  const fromAmount = asString(raw.fromAmount) ?? input.fromAmount;
  const toAmount =
    asString(raw.toAmount) ?? asString(raw.estimatedAmount) ?? asString(raw.transactionAmount);
  if (!toAmount) {
    throw new ChangeNowError("changenow_estimate_empty", 502);
  }
  return {
    fromCurrency: asString(raw.fromCurrency) ?? input.fromCurrency,
    toCurrency: asString(raw.toCurrency) ?? input.toCurrency,
    fromNetwork: asString(raw.fromNetwork) ?? input.fromNetwork,
    toNetwork: asString(raw.toNetwork) ?? input.toNetwork,
    fromAmount,
    toAmount,
    fromAmountUsd: asString(raw.fromAmountUsd) ?? asString(raw.fromUsdAmount),
    toAmountUsd: asString(raw.toAmountUsd) ?? asString(raw.toUsdAmount),
    transactionSpeedForecast: asString(raw.transactionSpeedForecast) ?? null,
    warningMessage: asString(raw.warningMessage) ?? null,
  };
}

export async function validateChangeNowAddress(input: {
  address: string;
  currency: string;
  network: string;
}): Promise<{ result: boolean; message?: string }> {
  const raw = asRecord(
    await nowGet<unknown>("/validate/address", {
      address: input.address,
      currency: input.currency,
      network: input.network,
    }),
  );
  const result = raw.result === true || raw.result === "true";
  return {
    result,
    message: asString(raw.message) ?? asString(raw.error),
  };
}

export async function fetchChangeNowMinAmount(input: {
  fromCurrency: string;
  toCurrency: string;
  fromNetwork: string;
  toNetwork: string;
}): Promise<string | undefined> {
  const raw = asRecord(
    await nowGet<unknown>("/exchange/min-amount", {
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      fromNetwork: input.fromNetwork,
      toNetwork: input.toNetwork,
      flow: "standard",
    }),
  );
  return asString(raw.minAmount) ?? asString(raw.min);
}

export async function createChangeNowExchange(input: {
  fromCurrency: string;
  toCurrency: string;
  fromNetwork: string;
  toNetwork: string;
  fromAmount: string;
  address: string;
  refundAddress: string;
  userId: string;
}): Promise<ChangeNowExchange> {
  if (!env.changeNowApiKey) {
    throw new ChangeNowError(
      "CHANGENOW_API_KEY is required to open a pay-in. Quotes still work without it.",
      503,
    );
  }
  const response = await fetch(`${CHANGE_NOW_BASE}/exchange`, {
    method: "POST",
    headers: headers(true),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      fromNetwork: input.fromNetwork,
      toNetwork: input.toNetwork,
      fromAmount: input.fromAmount,
      toAmount: "",
      address: input.address,
      extraId: "",
      refundAddress: input.refundAddress,
      refundExtraId: "",
      userId: input.userId,
      payload: "",
      contactEmail: "",
      source: BRAND_NAME,
      flow: "standard",
      type: "direct",
      rateId: "",
    }),
  });
  const parsed = asRecord(await response.json().catch(() => ({})));
  if (!response.ok) {
    throw new ChangeNowError(
      asString(parsed.message) ?? asString(parsed.error) ?? `changenow_${response.status}`,
      response.status >= 400 && response.status < 500 ? response.status : 502,
    );
  }
  const id = asString(parsed.id);
  const payinAddress = asString(parsed.payinAddress);
  const payoutAddress = asString(parsed.payoutAddress) ?? input.address;
  if (!id || !payinAddress) {
    throw new ChangeNowError("changenow_create_incomplete", 502);
  }
  return {
    id,
    status: asString(parsed.status) ?? "waiting",
    fromCurrency: asString(parsed.fromCurrency) ?? input.fromCurrency,
    toCurrency: asString(parsed.toCurrency) ?? input.toCurrency,
    fromNetwork: asString(parsed.fromNetwork) ?? input.fromNetwork,
    toNetwork: asString(parsed.toNetwork) ?? input.toNetwork,
    fromAmount: asString(parsed.fromAmount) ?? input.fromAmount,
    toAmount: asString(parsed.toAmount) ?? "",
    payinAddress,
    payoutAddress,
    payinExtraId: asString(parsed.payinExtraId) ?? null,
    refundAddress: asString(parsed.refundAddress) ?? input.refundAddress,
    validUntil: asString(parsed.validUntil) ?? null,
  };
}

export async function fetchChangeNowExchange(id: string): Promise<ChangeNowExchange> {
  const raw = asRecord(await nowGet<unknown>("/exchange/by-id", { id }));
  const exchangeId = asString(raw.id) ?? id;
  const payinAddress = asString(raw.payinAddress) ?? "";
  return {
    id: exchangeId,
    status: asString(raw.status) ?? "unknown",
    fromCurrency: asString(raw.fromCurrency) ?? "",
    toCurrency: asString(raw.toCurrency) ?? "",
    fromNetwork: asString(raw.fromNetwork) ?? "",
    toNetwork: asString(raw.toNetwork) ?? "",
    fromAmount: asString(raw.fromAmount) ?? asString(raw.amountSend) ?? "",
    toAmount: asString(raw.toAmount) ?? asString(raw.amountReceive) ?? "",
    payinAddress,
    payoutAddress: asString(raw.payoutAddress) ?? "",
    payinExtraId: asString(raw.payinExtraId) ?? null,
    refundAddress: asString(raw.refundAddress) ?? null,
    payinHash: asString(raw.payinHash) ?? asString(raw.payinHashId) ?? null,
    payoutHash: asString(raw.payoutHash) ?? asString(raw.payoutHashId) ?? null,
    validUntil: asString(raw.validUntil) ?? null,
  };
}

export function parseEstimateUsd(estimate: ChangeNowEstimate): { fromUsd?: string; toUsd?: string } {
  return {
    fromUsd: estimate.fromAmountUsd,
    toUsd: estimate.toAmountUsd,
  };
}
