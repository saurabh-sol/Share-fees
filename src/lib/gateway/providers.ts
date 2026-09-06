import { env } from "@/lib/env";
import type { LlmProvider } from "./catalog";
import { GatewayError } from "./errors";

export type ChatForwarder = (input: {
  body: unknown;
  signal?: AbortSignal;
}) => Promise<{
  response: Response;
  promptTokens: number;
  completionTokens: number;
  model: string;
}>;

type ChatMessage = { role?: string; content?: unknown };

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return content == null ? "" : String(content);
}

function asChatBody(body: unknown) {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const messages = Array.isArray(record.messages) ? (record.messages as ChatMessage[]) : [];
  return {
    model: typeof record.model === "string" ? record.model : "",
    maxTokens: typeof record.max_tokens === "number" ? record.max_tokens : 1024,
    messages,
  };
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

export function poolKeyFor(provider: LlmProvider) {
  if (provider === "anthropic") return env.anthropicApiKey;
  if (provider === "deepseek") return env.deepseekApiKey;
  return env.openaiApiKey;
}

export function providerReady(provider: LlmProvider) {
  return Boolean(poolKeyFor(provider));
}

const forwardOpenAICompatible = async (
  url: string,
  apiKey: string,
  body: unknown,
  signal?: AbortSignal,
) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  const json = await readJson(response);
  if (!response.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new GatewayError(err?.message ?? "provider_error", 502);
  }
  const usage = (json.usage ?? {}) as { prompt_tokens?: number; completion_tokens?: number };
  return {
    response: Response.json(json),
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    model: typeof json.model === "string" ? json.model : asChatBody(body).model,
  };
};

export const forwardToOpenAI: ChatForwarder = async ({ body, signal }) => {
  const key = env.openaiApiKey;
  if (!key) throw new GatewayError("provider_pool_empty", 503);
  return forwardOpenAICompatible("https://api.openai.com/v1/chat/completions", key, body, signal);
};

export const forwardToDeepSeek: ChatForwarder = async ({ body, signal }) => {
  const key = env.deepseekApiKey;
  if (!key) throw new GatewayError("provider_pool_empty", 503);
  return forwardOpenAICompatible("https://api.deepseek.com/chat/completions", key, body, signal);
};

export const forwardToAnthropic: ChatForwarder = async ({ body, signal }) => {
  const key = env.anthropicApiKey;
  if (!key) throw new GatewayError("provider_pool_empty", 503);
  const parsed = asChatBody(body);
  const system = parsed.messages
    .filter((item) => item.role === "system")
    .map((item) => contentToText(item.content))
    .filter(Boolean)
    .join("\n");
  const messages = parsed.messages
    .filter((item) => item.role !== "system")
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: contentToText(item.content),
    }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: parsed.model,
      max_tokens: parsed.maxTokens,
      system: system || undefined,
      messages,
    }),
    signal,
  });
  const json = await readJson(response);
  if (!response.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new GatewayError(err?.message ?? "provider_error", 502);
  }
  const content = Array.isArray(json.content) ? json.content : [];
  const text = content
    .map((part) => {
      if (part && typeof part === "object" && "text" in part) {
        return String((part as { text?: unknown }).text ?? "");
      }
      return "";
    })
    .join("");
  const usage = (json.usage ?? {}) as { input_tokens?: number; output_tokens?: number };
  const openaiShaped = {
    id: json.id ?? "chatcmpl_anthropic",
    object: "chat.completion",
    model: parsed.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: usage.input_tokens ?? 0,
      completion_tokens: usage.output_tokens ?? 0,
    },
  };
  return {
    response: Response.json(openaiShaped),
    promptTokens: usage.input_tokens ?? 0,
    completionTokens: usage.output_tokens ?? 0,
    model: parsed.model,
  };
};

export function forwarderFor(provider: LlmProvider): ChatForwarder {
  if (provider === "anthropic") return forwardToAnthropic;
  if (provider === "deepseek") return forwardToDeepSeek;
  return forwardToOpenAI;
}
