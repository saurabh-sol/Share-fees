import { env } from "@/lib/env";
import { gatewayModelSlug, type LlmProvider } from "./catalog";
import { GatewayError } from "./errors";

const AI_GATEWAY_CHAT = "https://ai-gateway.vercel.sh/v1/chat/completions";
const AI_GATEWAY_MESSAGES = "https://ai-gateway.vercel.sh/v1/messages";

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
    maxTokens:
      typeof record.max_tokens === "number"
        ? record.max_tokens
        : typeof record.max_completion_tokens === "number"
          ? record.max_completion_tokens
          : 1024,
    messages,
  };
}

async function readJson(response: Response) {
  return (await response.json()) as Record<string, unknown>;
}

export function aiGatewayAuth() {
  return env.aiGatewayApiKey || env.vercelOidcToken || "";
}

/** Gateway rejects OIDC JWTs as Authorization: Bearer. Keys use Bearer; OIDC uses x-vercel-oidc-token. */
export function aiGatewayHeaders(): Record<string, string> {
  if (env.aiGatewayApiKey) {
    return { authorization: `Bearer ${env.aiGatewayApiKey}` };
  }
  if (env.vercelOidcToken) {
    return { "x-vercel-oidc-token": env.vercelOidcToken };
  }
  return {};
}

/** Optional leftover per-provider keys. Prefer AI Gateway so .env does not hold house keys. */
export function poolKeyFor(provider: LlmProvider) {
  switch (provider) {
    case "anthropic":
      return env.anthropicApiKey;
    case "deepseek":
      return env.deepseekApiKey;
    case "google":
      return env.googleApiKey;
    case "grok":
      return env.xaiApiKey;
    case "openai":
      return env.openaiApiKey;
    case "mistral":
      return env.mistralApiKey;
    case "cohere":
      return env.cohereApiKey;
    case "perplexity":
      return env.perplexityApiKey;
    case "moonshot":
      return env.moonshotApiKey;
    default:
      return undefined;
  }
}

export function providerReady(provider: LlmProvider) {
  return Boolean(aiGatewayAuth() || poolKeyFor(provider));
}

function throwUnlessReady(provider: LlmProvider) {
  if (providerReady(provider)) return;
  throw new GatewayError("provider_pool_empty", 503);
}

const forwardOpenAICompatible = async (
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
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

async function forwardViaAiGatewayChat(
  provider: LlmProvider,
  publicModel: string,
  body: unknown,
  signal?: AbortSignal,
) {
  const token = aiGatewayAuth();
  if (!token) return null;
  const record = body && typeof body === "object" ? { ...(body as Record<string, unknown>) } : {};
  record.model = gatewayModelSlug(provider, publicModel);
  record.stream = false;
  const forwarded = await forwardOpenAICompatible(AI_GATEWAY_CHAT, aiGatewayHeaders(), record, signal);
  return {
    ...forwarded,
    model: publicModel,
  };
}

function gatewayForwarder(
  provider: LlmProvider,
  directUrl?: string,
  getKey?: () => string | undefined,
): ChatForwarder {
  return async ({ body, signal }) => {
    throwUnlessReady(provider);
    const publicModel = asChatBody(body).model;
    const viaGateway = await forwardViaAiGatewayChat(provider, publicModel, body, signal);
    if (viaGateway) return viaGateway;
    const key = getKey?.();
    if (directUrl && key) {
      return forwardOpenAICompatible(directUrl, { authorization: `Bearer ${key}` }, body, signal);
    }
    throw new GatewayError("provider_pool_empty", 503);
  };
}

export const forwardToOpenAI: ChatForwarder = async ({ body, signal }) => {
  throwUnlessReady("openai");
  const publicModel = asChatBody(body).model;
  const viaGateway = await forwardViaAiGatewayChat("openai", publicModel, body, signal);
  if (viaGateway) return viaGateway;
  const key = env.openaiApiKey;
  if (!key) throw new GatewayError("provider_pool_empty", 503);
  return forwardOpenAICompatible(
    "https://api.openai.com/v1/chat/completions",
    { authorization: `Bearer ${key}` },
    body,
    signal,
  );
};

export const forwardToDeepSeek: ChatForwarder = async ({ body, signal }) => {
  throwUnlessReady("deepseek");
  const publicModel = asChatBody(body).model;
  const viaGateway = await forwardViaAiGatewayChat("deepseek", publicModel, body, signal);
  if (viaGateway) return viaGateway;
  const key = env.deepseekApiKey;
  if (!key) throw new GatewayError("provider_pool_empty", 503);
  return forwardOpenAICompatible(
    "https://api.deepseek.com/v1/chat/completions",
    { authorization: `Bearer ${key}` },
    body,
    signal,
  );
};

export const forwardToGrok: ChatForwarder = async ({ body, signal }) => {
  throwUnlessReady("grok");
  const publicModel = asChatBody(body).model;
  const viaGateway = await forwardViaAiGatewayChat("grok", publicModel, body, signal);
  if (viaGateway) return viaGateway;
  const key = env.xaiApiKey;
  if (!key) throw new GatewayError("provider_pool_empty", 503);
  return forwardOpenAICompatible(
    "https://api.x.ai/v1/chat/completions",
    { authorization: `Bearer ${key}` },
    body,
    signal,
  );
};

export const forwardToAnthropic: ChatForwarder = async ({ body, signal }) => {
  throwUnlessReady("anthropic");
  const parsed = asChatBody(body);
  const viaGateway = await forwardViaAiGatewayChat("anthropic", parsed.model, body, signal);
  if (viaGateway) return viaGateway;
  const key = env.anthropicApiKey;
  if (!key) throw new GatewayError("provider_pool_empty", 503);
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
  const promptTokens = usage.input_tokens ?? 0;
  const completionTokens = usage.output_tokens ?? 0;
  const openaiShaped = {
    id: typeof json.id === "string" ? json.id : "chatcmpl_anthropic",
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: parsed.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: "stop",
        logprobs: null,
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
  return {
    response: Response.json(openaiShaped),
    promptTokens,
    completionTokens,
    model: parsed.model,
  };
};

export const forwardAnthropicMessages: ChatForwarder = async ({ body, signal }) => {
  throwUnlessReady("anthropic");
  const record = body && typeof body === "object" ? { ...(body as Record<string, unknown>) } : {};
  const publicModel = typeof record.model === "string" ? record.model : asChatBody(body).model;
  const token = aiGatewayAuth();
  if (token) {
    record.model = gatewayModelSlug("anthropic", publicModel);
    record.stream = false;
    const response = await fetch(AI_GATEWAY_MESSAGES, {
      method: "POST",
      headers: {
        ...aiGatewayHeaders(),
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(record),
      signal,
    });
    const json = await readJson(response);
    if (!response.ok) {
      const err = json.error as { message?: string } | undefined;
      throw new GatewayError(err?.message ?? "provider_error", 502);
    }
    const usage = (json.usage ?? {}) as { input_tokens?: number; output_tokens?: number };
    return {
      response: Response.json({ ...json, model: publicModel }),
      promptTokens: usage.input_tokens ?? 0,
      completionTokens: usage.output_tokens ?? 0,
      model: publicModel,
    };
  }

  const key = env.anthropicApiKey;
  if (!key) throw new GatewayError("provider_pool_empty", 503);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ ...record, stream: false }),
    signal,
  });
  const json = await readJson(response);
  if (!response.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new GatewayError(err?.message ?? "provider_error", 502);
  }
  const usage = (json.usage ?? {}) as { input_tokens?: number; output_tokens?: number };
  return {
    response: Response.json(json),
    promptTokens: usage.input_tokens ?? 0,
    completionTokens: usage.output_tokens ?? 0,
    model: typeof json.model === "string" ? json.model : publicModel,
  };
};

export const forwardToGoogle: ChatForwarder = async ({ body, signal }) => {
  throwUnlessReady("google");
  const publicModel = asChatBody(body).model;
  const viaGateway = await forwardViaAiGatewayChat("google", publicModel, body, signal);
  if (viaGateway) return viaGateway;
  const key = env.googleApiKey;
  if (!key) throw new GatewayError("provider_pool_empty", 503);
  const record = body && typeof body === "object" ? { ...(body as Record<string, unknown>) } : {};
  record.model = publicModel;
  record.stream = false;
  return forwardOpenAICompatible(
    "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    { authorization: `Bearer ${key}` },
    record,
    signal,
  );
};

export const forwardToMistral = gatewayForwarder(
  "mistral",
  "https://api.mistral.ai/v1/chat/completions",
  () => env.mistralApiKey,
);

export const forwardToMeta = gatewayForwarder("meta");

export const forwardToCohere = gatewayForwarder(
  "cohere",
  "https://api.cohere.com/compatibility/v1/chat/completions",
  () => env.cohereApiKey,
);

export const forwardToPerplexity = gatewayForwarder(
  "perplexity",
  "https://api.perplexity.ai/chat/completions",
  () => env.perplexityApiKey,
);

export const forwardToMoonshot = gatewayForwarder(
  "moonshot",
  "https://api.moonshot.cn/v1/chat/completions",
  () => env.moonshotApiKey,
);

export function forwarderFor(provider: LlmProvider): ChatForwarder {
  if (provider === "anthropic") return forwardToAnthropic;
  if (provider === "deepseek") return forwardToDeepSeek;
  if (provider === "google") return forwardToGoogle;
  if (provider === "grok") return forwardToGrok;
  if (provider === "mistral") return forwardToMistral;
  if (provider === "meta") return forwardToMeta;
  if (provider === "cohere") return forwardToCohere;
  if (provider === "perplexity") return forwardToPerplexity;
  if (provider === "moonshot") return forwardToMoonshot;
  return forwardToOpenAI;
}
