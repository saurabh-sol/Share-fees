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
import { spendableLlmCents } from "@/lib/ledger/desk-chat";
import { getDb } from "@/lib/db/client";
import {
  findActiveVirtualKey,
  releaseVirtualKeyReservation,
  reserveVirtualKey,
  settleVirtualKeyReservation,
} from "./service";

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
  const key = await findActiveVirtualKey(input.userId, provider, model, client);
  if (!key) {
    throw new GatewayError("redeem_required", 402);
  }

  const routed =
    provider === "anthropic"
      ? {
          model,
          max_tokens: 1024,
          stream: false,
          messages: input.messages.map((item) => ({
            role: item.role === "assistant" ? "assistant" : "user",
            content: item.content,
          })),
        }
      : {
          model,
          max_tokens: 1024,
          stream: false,
          messages: input.messages,
        };

  const reservation = await reserveVirtualKey(key.id, client);
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
    await settleVirtualKeyReservation(
      key.id,
      reservation.usedBefore,
      reservation.cap,
      spentCents,
      client,
    );
    const balances = await spendableLlmCents(input.userId, client);
    return {
      text: text || "(empty reply)",
      provider,
      model: usedModel,
      spentCents,
      creditCents: balances.creditCents,
      llmCents: balances.llmCents,
      usdtCents: balances.usdtCents,
    };
  } catch (error) {
    await releaseVirtualKeyReservation(key.id, reservation.usedBefore, client);
    if (error instanceof GatewayError) {
      throw error;
    }
    throw error;
  }
}

export const DESK_CHAT_DEFAULTS = {
  provider: DEFAULT_LLM_PROVIDER,
  model: DEFAULT_LLM_MODEL,
};
