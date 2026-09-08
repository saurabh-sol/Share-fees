import type { LlmProvider } from "./catalog";

export function originFromGatewayBase(baseUrl: string) {
  return baseUrl.replace(/\/v1\/?$/, "");
}

export type ClientSnippets = {
  host: string;
  base: string;
  label: string;
  sdkLabel: string;
  curl: string;
  sdk: string;
};

export function clientSnippets(
  provider: LlmProvider,
  baseUrl: string,
  apiKey: string,
  model: string,
  message = "Hello",
): ClientSnippets {
  const origin = originFromGatewayBase(baseUrl);
  const escapedMessage = message.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

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
  -d '{"model":"${model}","max_tokens":64,"messages":[{"role":"user","content":"${escapedMessage}"}]}'`,
      sdk: `import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: "${apiKey}",
  baseURL: "${origin}",
});

const message = await client.messages.create({
  model: "${model}",
  max_tokens: 64,
  messages: [{ role: "user", content: "${escapedMessage}" }],
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
  -d '{"contents":[{"role":"user","parts":[{"text":"${escapedMessage}"}]}]}'`,
      sdk: `import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: "${apiKey}",
  httpOptions: { baseUrl: "${origin}" },
});

const response = await ai.models.generateContent({
  model: "${model}",
  contents: "${escapedMessage}",
});

console.log(response.text);`,
    };
  }

  const chatCurl = `curl ${origin}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{"model":"${model}","messages":[{"role":"user","content":"${escapedMessage}"}]}'`;

  const chatSdk = `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "${apiKey}",
  baseURL: "${origin}/v1",
});

const completion = await client.chat.completions.create({
  model: "${model}",
  messages: [{ role: "user", content: "${escapedMessage}" }],
});

console.log(completion.choices[0].message.content);`;

  if (provider === "deepseek") {
    return {
      host: "api.deepseek.com/v1",
      base: `${origin}/v1`,
      label: "Official DeepSeek API",
      sdkLabel: "Official DeepSeek (OpenAI SDK)",
      curl: chatCurl,
      sdk: chatSdk,
    };
  }

  if (provider === "grok") {
    return {
      host: "api.x.ai/v1",
      base: `${origin}/v1`,
      label: "Official xAI Grok API",
      sdkLabel: "Official Grok (OpenAI SDK)",
      curl: chatCurl,
      sdk: chatSdk,
    };
  }

  return {
    host: "api.openai.com/v1",
    base: `${origin}/v1`,
    label: "Official OpenAI API",
    sdkLabel: "Official OpenAI SDK",
    curl: chatCurl,
    sdk: chatSdk,
  };
}
