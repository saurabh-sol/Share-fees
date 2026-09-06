"use client";

import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";
import type { LlmProvider } from "@/lib/gateway/catalog";

type CopyTarget = "key" | "url" | "curl" | "sdk";

function originFromBase(baseUrl: string) {
  return baseUrl.replace(/\/v1\/?$/, "");
}

function snippets(provider: LlmProvider, baseUrl: string, apiKey: string, model: string) {
  const origin = originFromBase(baseUrl);
  if (provider === "anthropic") {
    return {
      host: "api.anthropic.com",
      base: origin,
      label: "Official Anthropic API",
      sdkLabel: "Official Anthropic SDK",
      curl: `curl ${origin}/v1/messages \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey}" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{"model":"${model}","max_tokens":16,"messages":[{"role":"user","content":"Hello"}]}'`,
      sdk: `import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: "${apiKey}",
  baseURL: "${origin}",
});

const message = await client.messages.create({
  model: "${model}",
  max_tokens: 16,
  messages: [{ role: "user", content: "Hello" }],
});

console.log(message.content);`,
    };
  }

  if (provider === "google") {
    return {
      host: "generativelanguage.googleapis.com",
      base: origin,
      label: "Official Google Gemini API",
      sdkLabel: "Official Google GenAI SDK",
      curl: `curl ${origin}/v1beta/models/${model}:generateContent \\
  -H "Content-Type: application/json" \\
  -H "x-goog-api-key: ${apiKey}" \\
  -d '{"contents":[{"role":"user","parts":[{"text":"Hello"}]}]}'`,
      sdk: `import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: "${apiKey}",
  httpOptions: { baseUrl: "${origin}" },
});

const response = await ai.models.generateContent({
  model: "${model}",
  contents: "Hello",
});

console.log(response.text);`,
    };
  }

  if (provider === "deepseek") {
    return {
      host: "api.deepseek.com/v1",
      base: `${origin}/v1`,
      label: "Official DeepSeek API",
      sdkLabel: "Official DeepSeek (OpenAI SDK)",
      curl: `curl ${origin}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{"model":"${model}","messages":[{"role":"user","content":"Hello"}]}'`,
      sdk: `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "${apiKey}",
  baseURL: "${origin}/v1",
});

const completion = await client.chat.completions.create({
  model: "${model}",
  messages: [{ role: "user", content: "Hello" }],
});

console.log(completion.choices[0].message.content);`,
    };
  }

  return {
    host: "api.openai.com/v1",
    base: `${origin}/v1`,
    label: "Official OpenAI API",
    sdkLabel: "Official OpenAI SDK",
    curl: `curl ${origin}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{"model":"${model}","messages":[{"role":"user","content":"Hello"}]}'`,
    sdk: `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "${apiKey}",
  baseURL: "${origin}/v1",
});

const completion = await client.chat.completions.create({
  model: "${model}",
  messages: [{ role: "user", content: "Hello" }],
});

console.log(completion.choices[0].message.content);`,
  };
}

export function OpenAiKeyIssue({
  gatewayBaseUrl,
  issuedKey,
  issuedModel,
  issuedProvider,
}: {
  gatewayBaseUrl: string;
  issuedKey: string | null;
  issuedModel: string;
  issuedProvider: LlmProvider;
}) {
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const preview = snippets(issuedProvider, gatewayBaseUrl, issuedKey ?? "t2c_…", issuedModel);

  async function copy(value: string, which: CopyTarget) {
    await navigator.clipboard.writeText(value);
    setCopied(which);
  }

  return (
    <div className="space-y-8">
      <section className="max-w-[65ch] space-y-3 border-y border-white/8 py-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">{preview.label}</p>
        <p className="text-sm leading-relaxed text-zinc-400">
          Same paths and body as <span className="font-mono text-zinc-300">{preview.host}</span>.
          Redeem picks the provider. The <span className="font-mono">t2c_</span> key is that
          provider’s API key. Each call hits the real API and spends desk points.
        </p>
        <div className="flex items-center justify-between gap-4">
          <code className="font-mono text-sm text-zinc-100">{preview.base}</code>
          <button
            type="button"
            onClick={() => void copy(preview.base, "url")}
            className="inline-flex items-center gap-2 text-sm text-zinc-300"
          >
            {copied === "url" ? <Check size={16} /> : <Copy size={16} />}
            {copied === "url" ? "Copied" : "Copy"}
          </button>
        </div>
      </section>

      {issuedKey ? (
        <section className="space-y-6 border-y border-white/8 py-8">
          <div className="space-y-3">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Show once</p>
            <p className="max-w-[65ch] text-sm leading-relaxed text-zinc-400">
              This is the plaintext API key. It is not stored. Paste it as the official{" "}
              {issuedProvider === "anthropic"
                ? "x-api-key"
                : issuedProvider === "google"
                  ? "x-goog-api-key"
                  : "apiKey"}{" "}
              for {issuedProvider}.
              {issuedProvider === "google" ? (
                <>
                  {" "}
                  The same key also works as Bearer against{" "}
                  <span className="font-mono">{originFromBase(gatewayBaseUrl)}/v1</span>.
                </>
              ) : null}
            </p>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <code className="break-all font-mono text-sm text-zinc-100">{issuedKey}</code>
              <button
                type="button"
                onClick={() => void copy(issuedKey, "key")}
                className="inline-flex items-center gap-2 text-sm text-zinc-300"
              >
                {copied === "key" ? <Check size={16} /> : <Copy size={16} />}
                {copied === "key" ? "Copied" : "Copy key"}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
                Official curl
              </p>
              <button
                type="button"
                onClick={() => void copy(preview.curl, "curl")}
                className="inline-flex items-center gap-2 text-sm text-zinc-300"
              >
                {copied === "curl" ? <Check size={16} /> : <Copy size={16} />}
                {copied === "curl" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-zinc-300">
              {preview.curl}
            </pre>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
                {preview.sdkLabel}
              </p>
              <button
                type="button"
                onClick={() => void copy(preview.sdk, "sdk")}
                className="inline-flex items-center gap-2 text-sm text-zinc-300"
              >
                {copied === "sdk" ? <Check size={16} /> : <Copy size={16} />}
                {copied === "sdk" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-zinc-300">
              {preview.sdk}
            </pre>
          </div>
        </section>
      ) : null}
    </div>
  );
}
