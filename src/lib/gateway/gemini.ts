import { normalizePublicModel } from "./catalog";
import { reshapeProviderCompletion } from "./openai";

export type GeminiGenerateContent = {
  candidates: Array<{
    content: { role: "model"; parts: Array<{ text: string }> };
    finishReason: string;
    index: number;
  }>;
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  modelVersion: string;
};

type GeminiPath =
  | { kind: "openai-chat" }
  | { kind: "models" }
  | { kind: "model"; model: string }
  | { kind: "generate"; model: string }
  | { kind: "stream"; model: string }
  | { kind: "unknown" };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function partsToText(parts: unknown): string {
  if (typeof parts === "string") return parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => {
      if (typeof part === "string") return part;
      const row = asRecord(part);
      if (typeof row.text === "string") return row.text;
      return "";
    })
    .join("");
}

export function geminiErrorBody(code: string, status: number, message = code) {
  const statusText =
    status === 401
      ? "UNAUTHENTICATED"
      : status === 402
        ? "RESOURCE_EXHAUSTED"
        : status === 429
          ? "RESOURCE_EXHAUSTED"
          : status >= 500
            ? "INTERNAL"
            : "INVALID_ARGUMENT";
  return {
    error: {
      code: status,
      message,
      status: statusText,
      details: [{ reason: code }],
    },
  };
}

export function parseGeminiPath(parts: string[]): GeminiPath {
  const decoded = parts.map((part) => decodeURIComponent(part));
  const joined = decoded.join("/");
  if (joined === "openai/chat/completions") return { kind: "openai-chat" };
  if (joined === "openai/models" || joined === "models") return { kind: "models" };
  if (decoded[0] === "openai" && decoded[1] === "models" && decoded[2]) {
    return { kind: "model", model: normalizePublicModel("google", decoded.slice(2).join("/")) };
  }
  if (decoded[0] === "models" && decoded[1]) {
    const raw = decoded.slice(1).join("/");
    const colon = raw.lastIndexOf(":");
    if (colon === -1) {
      return { kind: "model", model: normalizePublicModel("google", raw) };
    }
    const model = normalizePublicModel("google", raw.slice(0, colon));
    const action = raw.slice(colon + 1);
    if (action === "generateContent") return { kind: "generate", model };
    if (action === "streamGenerateContent") return { kind: "stream", model };
    return { kind: "unknown" };
  }
  return { kind: "unknown" };
}

export function geminiToChatBody(model: string, body: unknown) {
  const record = asRecord(body);
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  const system = record.systemInstruction ?? record.system_instruction;
  if (system) {
    const text =
      typeof system === "string" ? system : partsToText(asRecord(system).parts);
    if (text) messages.push({ role: "system", content: text });
  }
  const contents = Array.isArray(record.contents) ? record.contents : [];
  for (const item of contents) {
    if (typeof item === "string") {
      messages.push({ role: "user", content: item });
      continue;
    }
    const row = asRecord(item);
    const role = row.role === "model" || row.role === "assistant" ? "assistant" : "user";
    const text = partsToText(row.parts) || (typeof row.text === "string" ? row.text : "");
    if (text) messages.push({ role, content: text });
  }
  const gen = asRecord(record.generationConfig ?? record.generation_config);
  const maxTokens =
    typeof gen.maxOutputTokens === "number"
      ? gen.maxOutputTokens
      : typeof gen.max_output_tokens === "number"
        ? gen.max_output_tokens
        : 1024;
  return {
    model,
    messages,
    max_tokens: maxTokens,
    stream: false,
  };
}

export function reshapeGeminiContent(json: unknown, fallbackModel: string): GeminiGenerateContent {
  const record = asRecord(json);
  if (Array.isArray(record.candidates)) {
    const usage = asRecord(record.usageMetadata ?? record.usage);
    return {
      candidates: record.candidates.map((candidate, index) => {
        const row = asRecord(candidate);
        const content = asRecord(row.content);
        return {
          content: {
            role: "model" as const,
            parts: [{ text: partsToText(content.parts) }],
          },
          finishReason: typeof row.finishReason === "string" ? row.finishReason : "STOP",
          index: typeof row.index === "number" ? row.index : index,
        };
      }),
      usageMetadata: {
        promptTokenCount: Number(usage.promptTokenCount ?? usage.prompt_tokens ?? 0),
        candidatesTokenCount: Number(usage.candidatesTokenCount ?? usage.completion_tokens ?? 0),
        totalTokenCount: Number(usage.totalTokenCount ?? usage.total_tokens ?? 0),
      },
      modelVersion: typeof record.modelVersion === "string" ? record.modelVersion : fallbackModel,
    };
  }

  const openai = reshapeProviderCompletion(json, fallbackModel);
  const text = openai.choices[0]?.message.content ?? "";
  return {
    candidates: [
      {
        content: { role: "model", parts: [{ text }] },
        finishReason: "STOP",
        index: 0,
      },
    ],
    usageMetadata: {
      promptTokenCount: openai.usage.prompt_tokens,
      candidatesTokenCount: openai.usage.completion_tokens,
      totalTokenCount: openai.usage.total_tokens,
    },
    modelVersion: openai.model || fallbackModel,
  };
}
