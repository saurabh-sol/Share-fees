import { describe, expect, it } from "vitest";
import { reshapeAnthropicMessage } from "./anthropic";
import { openaiErrorBody, readGatewayApiKey, reshapeProviderCompletion } from "./openai";

describe("official provider shapes", () => {
  it("fills the OpenAI chat.completion contract", () => {
    const shaped = reshapeProviderCompletion(
      {
        id: "chatcmpl_test",
        choices: [{ message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 8, completion_tokens: 2 },
      },
      "gpt-4o-mini",
    );
    expect(shaped.object).toBe("chat.completion");
    expect(shaped.model).toBe("gpt-4o-mini");
    expect(shaped.choices[0]?.message.content).toBe("ok");
    expect(shaped.usage.total_tokens).toBe(10);
    expect(typeof shaped.created).toBe("number");
    expect(shaped.choices[0]?.logprobs).toBeNull();
  });

  it("returns the official Anthropic message contract", () => {
    const shaped = reshapeAnthropicMessage(
      {
        id: "msg_1",
        type: "message",
        model: "claude-haiku-4-5",
        content: [{ type: "text", text: "ok" }],
        usage: { input_tokens: 4, output_tokens: 2 },
      },
      "claude-haiku-4-5",
    );
    expect(shaped.type).toBe("message");
    expect(shaped.role).toBe("assistant");
    expect(shaped.content[0]?.text).toBe("ok");
    expect(shaped.usage.input_tokens).toBe(4);
  });

  it("maps OpenAI errors and reads x-api-key like Anthropic", () => {
    const body = openaiErrorBody("model_not_allowed", 400);
    expect(body.error.code).toBe("model_not_found");
    expect(body.error.param).toBe("model");
    const request = new Request("http://localhost/v1/messages", {
      headers: { "x-api-key": "t2c_test" },
    });
    expect(readGatewayApiKey(request)).toBe("Bearer t2c_test");
  });
});
