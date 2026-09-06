import { describe, expect, it } from "vitest";
import { geminiToChatBody, parseGeminiPath, reshapeGeminiContent } from "./gemini";
import { findModel } from "./catalog";
import { readGatewayApiKey } from "./openai";

describe("Google Gemini gateway", () => {
  it("parses official generateContent and OpenAI-compat paths", () => {
    expect(parseGeminiPath(["openai", "chat", "completions"])).toEqual({ kind: "openai-chat" });
    expect(parseGeminiPath(["models"])).toEqual({ kind: "models" });
    expect(parseGeminiPath(["models", "gemini-2.5-flash:generateContent"])).toEqual({
      kind: "generate",
      model: "gemini-2.5-flash",
    });
    expect(parseGeminiPath(["models", "models%2Fgemini-2.5-flash:generateContent"])).toEqual({
      kind: "generate",
      model: "gemini-2.5-flash",
    });
    expect(parseGeminiPath(["models", "gemini-2.5-flash:streamGenerateContent"])).toEqual({
      kind: "stream",
      model: "gemini-2.5-flash",
    });
  });

  it("accepts models/ prefixes used by the official Gemini API", () => {
    expect(findModel("google", "models/gemini-2.5-flash")?.id).toBe("gemini-2.5-flash");
    expect(findModel("google", "google/gemini-2.5-flash-lite")?.id).toBe("gemini-2.5-flash-lite");
  });

  it("converts generateContent bodies to chat completions", () => {
    const routed = geminiToChatBody("gemini-2.5-flash", {
      systemInstruction: { parts: [{ text: "Be brief." }] },
      contents: [
        { role: "user", parts: [{ text: "Hello" }] },
        { role: "model", parts: [{ text: "Hi." }] },
        { role: "user", parts: [{ text: "Again" }] },
      ],
      generationConfig: { maxOutputTokens: 32 },
    });
    expect(routed.model).toBe("gemini-2.5-flash");
    expect(routed.max_tokens).toBe(32);
    expect(routed.messages).toEqual([
      { role: "system", content: "Be brief." },
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi." },
      { role: "user", content: "Again" },
    ]);
  });

  it("reshapes OpenAI completions into generateContent", () => {
    const shaped = reshapeGeminiContent(
      {
        model: "gemini-2.5-flash",
        choices: [{ message: { role: "assistant", content: "ok" } }],
        usage: { prompt_tokens: 8, completion_tokens: 2, total_tokens: 10 },
      },
      "gemini-2.5-flash",
    );
    expect(shaped.candidates[0]?.content.parts[0]?.text).toBe("ok");
    expect(shaped.usageMetadata.totalTokenCount).toBe(10);
    expect(shaped.modelVersion).toBe("gemini-2.5-flash");
  });

  it("reads x-goog-api-key and ?key= like official Gemini clients", () => {
    const header = new Request("http://localhost/v1beta/models/gemini-2.5-flash:generateContent", {
      headers: { "x-goog-api-key": "t2c_google" },
    });
    expect(readGatewayApiKey(header)).toBe("Bearer t2c_google");
    const query = new Request("http://localhost/v1beta/models/gemini-2.5-flash:generateContent?key=t2c_query");
    expect(readGatewayApiKey(query)).toBe("Bearer t2c_query");
  });
});
