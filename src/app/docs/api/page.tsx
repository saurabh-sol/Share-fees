import type { Metadata } from "next";
import { docsPageTitle } from "@/lib/brand";
import { DocsCode } from "@/components/docs/DocsCode";
import { DocsCallout, DocsH1, DocsH2, DocsLead, DocsP, DocsTable } from "@/components/docs/DocsPrimitives";
import { DocsPager } from "@/components/docs/DocsPager";
import { env } from "@/lib/env";
import { LLM_PROVIDER_SUMMARY } from "@/lib/gateway/catalog";
import { OFFICIAL_API_DESK_POINTS } from "@/lib/gateway/official-apis";

export const metadata: Metadata = {
  title: docsPageTitle("API"),
  description: `Use an acc_ key with the official ${LLM_PROVIDER_SUMMARY} SDK.`,
};

export default function ApiDocsPage() {
  const origin = env.publicAppUrl.replace(/\/$/, "");

  return (
    <>
      <DocsH1>API</DocsH1>
      <DocsLead>
        Redeem locks a provider. The acc_ key is that vendor’s real contract. Usage hits the live model and
        burns remaining cents. Upstream credentials stay on the server.
      </DocsLead>

      <DocsTable
        headers={["Vendor", "Path", "Auth"]}
        rows={OFFICIAL_API_DESK_POINTS.map((item) => [item.vendor, item.path, item.auth])}
      />
      <DocsP>
        Base URL is this origin. /gateway/v1 is the same API. Official SDKs work if you override baseURL.
      </DocsP>
      <DocsP>
        After you redeem, use the official SDK against this origin. The in-desk Try API tester is locked for
        now — it will be live soon.
      </DocsP>

      <DocsH2 id="openai-compat">OpenAI-compatible vendors</DocsH2>
      <DocsP>
        OpenAI, DeepSeek, Grok, Mistral, Meta, Cohere, Perplexity, and Moonshot share the chat completions
        contract. Point the OpenAI SDK at this origin.
      </DocsP>
      <DocsH2 id="openai-deepseek-grok">Example (OpenAI SDK)</DocsH2>
      <DocsCode
        language="js"
        code={`import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "acc_…",
  baseURL: "${origin}/v1",
});

await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello" }],
});`}
      />

      <DocsH2 id="anthropic">Anthropic</DocsH2>
      <DocsCode
        language="js"
        code={`import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: "acc_…",
  baseURL: "${origin}",
});

await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 256,
  messages: [{ role: "user", content: "Hello" }],
});`}
      />

      <DocsH2 id="google">Google</DocsH2>
      <DocsP>
        Use the official generateContent path against this origin. Header is x-goog-api-key with the acc_ key.
        The model id is the one you locked at redeem.
      </DocsP>
      <DocsCode
        language="bash"
        code={`curl ${origin}/v1beta/models/gemini-2.0-flash:generateContent \\
  -H "x-goog-api-key: acc_…" \\
  -H "content-type: application/json" \\
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'`}
      />

      <DocsH2 id="errors">Errors</DocsH2>
      <DocsP>
        401 means the key is missing, revoked, or unknown. 400 means the body failed validation. 402 means the
        cap is spent. 503 means the upstream gateway is unset for that vendor. Desk credit still caps the key
        even when Gateway is healthy.
      </DocsP>
      <DocsCallout title="Do not put vendor keys in the client">
        acc_ is the only key you paste into Cursor or a local SDK. {LLM_PROVIDER_SUMMARY} keys never leave the
        server.
      </DocsCallout>
      <DocsPager href="/docs/api" />
    </>
  );
}
