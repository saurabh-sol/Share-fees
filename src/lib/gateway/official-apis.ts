import { LLM_CATALOG, type LlmProvider } from "./catalog";

export type OfficialApiDeskPoint = {
  provider: LlmProvider;
  vendor: string;
  host: string;
  path: string;
  auth: string;
  logo: string;
};

export const PROVIDER_LOGO: Record<LlmProvider, string> = {
  anthropic: "/claude.png",
  openai: "/openai.png",
  deepseek: "/deepseek.png",
  google: "/gemini.png",
  grok: "/grok.png",
  mistral: "/mistral.png",
  meta: "/meta.png",
  cohere: "/cohere.png",
  perplexity: "/perplexity.png",
  moonshot: "/moonshot.png",
};

const DESK_META: Record<
  LlmProvider,
  Pick<OfficialApiDeskPoint, "host" | "path" | "auth">
> = {
  openai: {
    host: "api.openai.com/v1",
    path: "POST /v1/chat/completions",
    auth: "Authorization: Bearer acc_…",
  },
  anthropic: {
    host: "api.anthropic.com",
    path: "POST /v1/messages",
    auth: "x-api-key: acc_…",
  },
  deepseek: {
    host: "api.deepseek.com/v1",
    path: "POST /v1/chat/completions",
    auth: "Authorization: Bearer acc_…",
  },
  google: {
    host: "generativelanguage.googleapis.com",
    path: "POST /v1beta/models/{model}:generateContent",
    auth: "x-goog-api-key: acc_…",
  },
  grok: {
    host: "api.x.ai/v1",
    path: "POST /v1/chat/completions",
    auth: "Authorization: Bearer acc_…",
  },
  mistral: {
    host: "api.mistral.ai/v1",
    path: "POST /v1/chat/completions",
    auth: "Authorization: Bearer acc_…",
  },
  meta: {
    host: "llama.developer.meta.com/v1",
    path: "POST /v1/chat/completions",
    auth: "Authorization: Bearer acc_…",
  },
  cohere: {
    host: "api.cohere.com/compatibility/v1",
    path: "POST /v1/chat/completions",
    auth: "Authorization: Bearer acc_…",
  },
  perplexity: {
    host: "api.perplexity.ai",
    path: "POST /chat/completions",
    auth: "Authorization: Bearer acc_…",
  },
  moonshot: {
    host: "api.moonshot.cn/v1",
    path: "POST /v1/chat/completions",
    auth: "Authorization: Bearer acc_…",
  },
};

export const OFFICIAL_API_DESK_POINTS: readonly OfficialApiDeskPoint[] = LLM_CATALOG.map(
  (house) => ({
    provider: house.id,
    vendor: house.label,
    logo: PROVIDER_LOGO[house.id],
    ...DESK_META[house.id],
  }),
);

export function officialApiHost(provider: LlmProvider) {
  return DESK_META[provider].host;
}
