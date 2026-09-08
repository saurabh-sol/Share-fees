import {
  RESPONSE_HEADER_PROVIDER,
  RESPONSE_HEADER_REMAINING,
  RESPONSE_HEADER_SPEND_CAP,
} from "@/lib/brand";
import type { LlmProvider } from "./catalog";
import { originFromGatewayBase } from "./client-snippets";

export const DEFAULT_TRY_MESSAGE = "Say hello in one sentence.";

export type TryRequest = {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: unknown;
};

export type TryResultHeaders = {
  remainingCents: number | null;
  provider: string | null;
  spendCapCents: number | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function buildTryRequest(input: {
  provider: LlmProvider;
  model: string;
  gatewayBaseUrl: string;
  apiKey: string;
  message: string;
}): TryRequest {
  const origin = originFromGatewayBase(input.gatewayBaseUrl);
  const text = input.message.trim() || DEFAULT_TRY_MESSAGE;

  if (input.provider === "anthropic") {
    return {
      url: `${origin}/v1/messages`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: {
        model: input.model,
        max_tokens: 64,
        messages: [{ role: "user", content: text }],
      },
    };
  }

  if (input.provider === "google") {
    return {
      url: `${origin}/v1beta/models/${input.model}:generateContent`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": input.apiKey,
      },
      body: {
        contents: [{ role: "user", parts: [{ text }] }],
      },
    };
  }

  return {
    url: `${origin}/v1/chat/completions`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: {
      model: input.model,
      messages: [{ role: "user", content: text }],
    },
  };
}

export function readTryResultHeaders(response: Response): TryResultHeaders {
  const read = (name: string) => {
    const raw = response.headers.get(name);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    remainingCents: read(RESPONSE_HEADER_REMAINING),
    provider: response.headers.get(RESPONSE_HEADER_PROVIDER),
    spendCapCents: read(RESPONSE_HEADER_SPEND_CAP),
  };
}

export function extractTryReply(provider: LlmProvider, json: unknown): string {
  const record = asRecord(json);

  if (provider === "anthropic") {
    const content = record.content;
    if (Array.isArray(content)) {
      const text = content
        .map((block) => {
          const row = asRecord(block);
          return row.type === "text" && typeof row.text === "string" ? row.text : "";
        })
        .join("")
        .trim();
      if (text) return text;
    }
  }

  if (provider === "google") {
    const candidates = record.candidates;
    if (Array.isArray(candidates)) {
      const first = asRecord(candidates[0]);
      const parts = asRecord(first.content).parts;
      if (Array.isArray(parts)) {
        const text = parts
          .map((part) => {
            const row = asRecord(part);
            return typeof row.text === "string" ? row.text : "";
          })
          .join("")
          .trim();
        if (text) return text;
      }
    }
  }

  const choices = record.choices;
  if (Array.isArray(choices)) {
    const first = asRecord(choices[0]);
    const message = asRecord(first.message);
    if (typeof message.content === "string" && message.content.trim()) {
      return message.content.trim();
    }
  }

  const error = asRecord(record.error);
  if (typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return "No reply text in the response.";
}

function errorMessage(json: unknown): string | null {
  const record = asRecord(json);
  const error = asRecord(record.error);
  if (typeof error.message === "string" && error.message.trim()) return error.message.trim();
  if (typeof record.message === "string" && record.message.trim()) return record.message.trim();
  return null;
}

export function humanizeTryError(status: number, json: unknown, lockedModel?: string): string {
  const raw = errorMessage(json)?.toLowerCase() ?? "";

  if (status === 401 || raw.includes("invalid_api_key")) {
    return "This key was not recognized. Paste the full acc_ key or redeem a new one.";
  }
  if (status === 402 || raw.includes("insufficient_credits")) {
    return "This key is out of credit. Redeem more LLM credits on the desk.";
  }
  if (status === 503 || raw.includes("not configured") || raw.includes("provider")) {
    return "That provider is unavailable right now. Try again later.";
  }
  if (status === 429 || raw.includes("rate_limit")) {
    return "Too many requests. Wait a minute and try again.";
  }
  if (
    status === 400 &&
    (raw.includes("model_not_allowed") ||
      raw.includes("model_not_found") ||
      raw.includes("model") ||
      raw.includes("wrong"))
  ) {
    return lockedModel
      ? `This key is locked to ${lockedModel}. Pick that model and try again.`
      : "This key is locked to a different model than the one selected.";
  }

  const detail = errorMessage(json);
  if (detail) return detail;
  return "The API request failed. Check your key and try again.";
}

export function moneyFromCents(cents: number | null) {
  if (cents === null) return null;
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
