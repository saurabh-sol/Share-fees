import {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROVIDER,
  LLM_CATALOG,
  assertProviderModel,
  estimateUsageCents,
  type LlmProvider,
} from "./catalog";
import { GatewayError } from "./errors";
import { reshapeAnthropicMessage } from "./anthropic";
import { reshapeProviderCompletion } from "./openai";
import { type ChatForwarder, forwardAnthropicMessages, forwarderFor, providerReady } from "./providers";
import {
  DESK_CHAT_MAX_TOKENS,
  holdLlmRail,
  releaseLlmHold,
  settleLlmHold,
  spendableLlmCents,
} from "@/lib/ledger/desk-chat";
import { LedgerError } from "@/lib/ledger/post-swap-reward";
import { getDb } from "@/lib/db/client";

export type DeskChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export function deskCatalog() {
  return LLM_CATALOG.map((provider) => ({
    id: provider.id,
    label: provider.label,
    ready: providerReady(provider.id),
    models: provider.models.map((model) => ({
      id: model.id,
      label: model.label,
      inputPerMillion: model.inputPerMillion,
      outputPerMillion: model.outputPerMillion,
    })),
  }));
}

export async function deskChatStatus(userId: string) {
  const balances = await spendableLlmCents(userId);
  return {
    ...balances,
    catalog: deskCatalog(),
    anyProviderReady: LLM_CATALOG.some((item) => providerReady(item.id)),
  };
}

function assistantText(provider: LlmProvider, raw: unknown, model: string) {
  if (provider === "anthropic") {
    return reshapeAnthropicMessage(raw, model)
      .content.map((part) => part.text)
      .join("")
      .trim();
  }
  return reshapeProviderCompletion(raw, model).choices[0]?.message.content.trim() ?? "";
}

export async function handleDeskChat(input: {
  userId: string;
  provider: LlmProvider;
  model: string;
  messages: DeskChatMessage[];
  forward?: ChatForwarder;
  db?: Awaited<ReturnType<typeof getDb>>;
}) {
  let provider: LlmProvider;
  let model: string;
  try {
    const locked = assertProviderModel(input.provider, input.model);
    provider = locked.provider;
    model = locked.model;
  } catch {
    throw new GatewayError("invalid_llm_model", 400);
  }
  if (!providerReady(provider) && !input.forward) {
    throw new GatewayError("provider_pool_empty", 503);
  }

  const last = input.messages[input.messages.length - 1];
  if (!last || last.role !== "user" || !last.content.trim()) {
    throw new GatewayError("invalid_body", 400);
  }

  const client = input.db ?? (await getDb());
  const promptTokens = Math.max(
    1,
    Math.ceil(input.messages.reduce((sum, item) => sum + item.content.length, 0) / 4),
  );
  const reserveCents = estimateUsageCents({
    provider,
    model,
    promptTokens,
    completionTokens: DESK_CHAT_MAX_TOKENS,
  });

  let holdId: string;
  try {
    const held = await holdLlmRail(input.userId, reserveCents, client);
    holdId = held.holdId;
  } catch (error) {
    if (error instanceof LedgerError) {
      throw new GatewayError(error.message, error.status);
    }
    throw error;
  }

  const routed =
    provider === "anthropic"
      ? {
          model,
          max_tokens: DESK_CHAT_MAX_TOKENS,
          stream: false,
          messages: input.messages.map((item) => ({
            role: item.role === "assistant" ? "assistant" : "user",
            content: item.content,
          })),
        }
      : {
          model,
          max_tokens: DESK_CHAT_MAX_TOKENS,
          stream: false,
          messages: input.messages,
        };

  try {
    const forward =
      input.forward ?? (provider === "anthropic" ? forwardAnthropicMessages : forwarderFor(provider));
    const result = await forward({ body: routed });
    const raw = (await result.response.json()) as unknown;
    const usedModel = result.model || model;
    const text = assistantText(provider, raw, usedModel);
    const spentCents = estimateUsageCents({
      provider,
      model: usedModel,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    });
    const charged = await settleLlmHold(input.userId, holdId, spentCents, client);
    return {
      text: text || "(empty reply)",
      provider,
      model: usedModel,
      spentCents: charged.chargedCents,
      creditCents: charged.creditCents,
      llmCents: charged.llmCents,
      usdtCents: charged.usdtCents,
    };
  } catch (error) {
    await releaseLlmHold(input.userId, holdId, client);
    if (error instanceof LedgerError) {
      throw new GatewayError(error.message, error.status);
    }
    throw error;
  }
}

export const DESK_CHAT_DEFAULTS = {
  provider: DEFAULT_LLM_PROVIDER,
  model: DEFAULT_LLM_MODEL,
};
