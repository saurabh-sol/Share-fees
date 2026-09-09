import { describe, expect, it } from "vitest";
import {
  buildTryRequest,
  extractTryReply,
  humanizeTryError,
  readTryResultHeaders,
  resolvePlaygroundRequestOrigin,
} from "./try-request";
import {
  RESPONSE_HEADER_PROVIDER,
  RESPONSE_HEADER_REMAINING,
  RESPONSE_HEADER_SPEND_CAP,
} from "@/lib/brand";

const base = "https://accrued.example/v1";

describe("buildTryRequest", () => {
  it("builds OpenAI chat completion", () => {
    const req = buildTryRequest({
      provider: "openai",
      model: "gpt-4o-mini",
      gatewayBaseUrl: base,
      apiKey: "acc_test",
      message: "Hi",
    });
    expect(req.url).toBe("https://accrued.example/v1/chat/completions");
    expect(req.headers.Authorization).toBe("Bearer acc_test");
    expect(req.body).toMatchObject({ model: "gpt-4o-mini" });
  });

  it("builds Grok chat completion", () => {
    const req = buildTryRequest({
      provider: "grok",
      model: "grok-2",
      gatewayBaseUrl: base,
      apiKey: "acc_test",
      message: "Hi",
    });
    expect(req.url).toContain("/v1/chat/completions");
  });

  it("builds Anthropic messages", () => {
    const req = buildTryRequest({
      provider: "anthropic",
      model: "claude-sonnet-4",
      gatewayBaseUrl: base,
      apiKey: "acc_test",
      message: "Hi",
    });
    expect(req.url).toBe("https://accrued.example/v1/messages");
    expect(req.headers["x-api-key"]).toBe("acc_test");
  });

  it("builds Google generateContent", () => {
    const req = buildTryRequest({
      provider: "google",
      model: "gemini-2.0-flash",
      gatewayBaseUrl: base,
      apiKey: "acc_test",
      message: "Hi",
    });
    expect(req.url).toBe("https://accrued.example/v1beta/models/gemini-2.0-flash:generateContent");
    expect(req.headers["x-goog-api-key"]).toBe("acc_test");
  });

  it("prefers requestOrigin over gatewayBaseUrl for live browser fetches", () => {
    const req = buildTryRequest({
      provider: "openai",
      model: "gpt-4o-mini",
      gatewayBaseUrl: "http://localhost:3000/v1",
      requestOrigin: "http://localhost:3001",
      apiKey: "acc_test",
      message: "Hi",
    });
    expect(req.url).toBe("http://localhost:3001/v1/chat/completions");
  });
});

describe("resolvePlaygroundRequestOrigin", () => {
  it("uses the live tab origin on localhost", () => {
    expect(
      resolvePlaygroundRequestOrigin("http://localhost:3000/v1", {
        origin: "http://localhost:3001",
        hostname: "localhost",
      }),
    ).toBe("http://localhost:3001");
  });

  it("uses the configured gateway URL on production", () => {
    expect(
      resolvePlaygroundRequestOrigin("https://accrued.trade/v1", {
        origin: "https://accrued.trade",
        hostname: "accrued.trade",
      }),
    ).toBe("https://accrued.trade");
  });
});

describe("extractTryReply", () => {
  it("reads OpenAI content", () => {
    expect(
      extractTryReply("openai", {
        choices: [{ message: { content: "Hello there" } }],
      }),
    ).toBe("Hello there");
  });

  it("reads Anthropic content blocks", () => {
    expect(
      extractTryReply("anthropic", {
        content: [{ type: "text", text: "Hi from Claude" }],
      }),
    ).toBe("Hi from Claude");
  });

  it("reads Gemini candidates", () => {
    expect(
      extractTryReply("google", {
        candidates: [{ content: { parts: [{ text: "Hi from Gemini" }] } }],
      }),
    ).toBe("Hi from Gemini");
  });
});

describe("humanizeTryError", () => {
  it("maps 401", () => {
    expect(humanizeTryError(401, { error: { message: "invalid_api_key" } })).toContain("not recognized");
  });

  it("maps 402", () => {
    expect(humanizeTryError(402, { error: { message: "insufficient_credits" } })).toContain("out of credit");
  });

  it("maps model mismatch", () => {
    expect(humanizeTryError(400, { error: { message: "model_not_allowed" } }, "gpt-4o-mini")).toContain(
      "gpt-4o-mini",
    );
  });
});

describe("readTryResultHeaders", () => {
  it("parses accrued headers", () => {
    const headers = new Headers({
      [RESPONSE_HEADER_REMAINING]: "1250",
      [RESPONSE_HEADER_PROVIDER]: "openai",
      [RESPONSE_HEADER_SPEND_CAP]: "2000",
    });
    expect(readTryResultHeaders({ headers } as Response)).toEqual({
      remainingCents: 1250,
      provider: "openai",
      spendCapCents: 2000,
    });
  });
});
