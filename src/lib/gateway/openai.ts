import { GatewayError } from "./errors";

export const OPENAI_MODEL_CREATED = 1_704_067_200;

export type OpenAiErrorType =
  | "invalid_request_error"
  | "authentication_error"
  | "insufficient_quota"
  | "rate_limit_error"
  | "api_error";

export type OpenAiChatCompletion = {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: "assistant" | "user" | "system"; content: string };
    finish_reason: string;
    logprobs: null | unknown;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type OpenAiModel = {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function messageContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === "string") return part;
        const row = asRecord(part);
        if (typeof row.text === "string") return row.text;
        if (typeof row.content === "string") return row.content;
        return "";
      })
      .join("");
  }
  return value == null ? "" : String(value);
}

export function openaiErrorBody(code: string, status: number, message = code) {
  const type: OpenAiErrorType =
    status === 401
      ? "authentication_error"
      : status === 402
        ? "insufficient_quota"
        : status === 429
          ? "rate_limit_error"
          : status >= 500
            ? "api_error"
            : "invalid_request_error";
  const officialCode =
    code === "insufficient_credits"
      ? "insufficient_quota"
      : code === "model_not_allowed"
        ? "model_not_found"
        : code;
  return {
    error: {
      message,
      type,
      param: officialCode === "model_not_found" ? "model" : null,
      code: officialCode,
    },
  };
}

export function toOpenAiModel(id: string, ownedBy: string): OpenAiModel {
  return {
    id,
    object: "model",
    created: OPENAI_MODEL_CREATED,
    owned_by: ownedBy,
  };
}

export function reshapeProviderCompletion(
  json: unknown,
  fallbackModel: string,
): OpenAiChatCompletion {
  const record = asRecord(json);
  const usage = asRecord(record.usage);
  const promptTokens = Number(usage.prompt_tokens ?? 0);
  const completionTokens = Number(usage.completion_tokens ?? 0);
  const rawChoices = Array.isArray(record.choices) ? record.choices : [];
  const choices: OpenAiChatCompletion["choices"] = rawChoices.map((choice, index) => {
    const row = asRecord(choice);
    const message = asRecord(row.message);
    const role: OpenAiChatCompletion["choices"][number]["message"]["role"] =
      message.role === "user" || message.role === "system" || message.role === "assistant"
        ? message.role
        : "assistant";
    return {
      index: typeof row.index === "number" ? row.index : index,
      message: {
        role,
        content: messageContent(message.content),
      },
      finish_reason: typeof row.finish_reason === "string" ? row.finish_reason : "stop",
      logprobs: row.logprobs ?? null,
    };
  });

  return {
    id:
      typeof record.id === "string" && record.id.length > 0
        ? record.id
        : `chatcmpl_${crypto.randomUUID().replaceAll("-", "")}`,
    object: "chat.completion",
    created: typeof record.created === "number" ? record.created : Math.floor(Date.now() / 1000),
    model: typeof record.model === "string" && record.model.length > 0 ? record.model : fallbackModel,
    choices:
      choices.length > 0
        ? choices
        : [
            {
              index: 0,
              message: { role: "assistant", content: "" },
              finish_reason: "stop",
              logprobs: null,
            },
          ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens:
        typeof usage.total_tokens === "number" ? usage.total_tokens : promptTokens + completionTokens,
    },
  };
}

export function readGatewayApiKey(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization) {
    return authorization.startsWith("Bearer ") ? authorization : `Bearer ${authorization}`;
  }
  const apiKey =
    request.headers.get("x-goog-api-key")?.trim() ||
    request.headers.get("x-api-key")?.trim() ||
    request.headers.get("api-key")?.trim();
  if (apiKey) return `Bearer ${apiKey}`;
  const queryKey = new URL(request.url).searchParams.get("key")?.trim();
  if (queryKey) return `Bearer ${queryKey}`;
  throw new GatewayError("invalid_api_key", 401);
}

export const readOpenAiApiKey = readGatewayApiKey;
