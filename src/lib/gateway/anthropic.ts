export type AnthropicMessage = {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: Array<{ type: "text"; text: string }>;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function anthropicErrorBody(code: string, status: number, message = code) {
  const type =
    status === 401
      ? "authentication_error"
      : status === 402
        ? "invalid_request_error"
        : status === 429
          ? "rate_limit_error"
          : status >= 500
            ? "api_error"
            : "invalid_request_error";
  return {
    type: "error" as const,
    error: {
      type,
      message,
    },
  };
}

export function reshapeAnthropicMessage(json: unknown, fallbackModel: string): AnthropicMessage {
  const record = asRecord(json);
  if (record.type === "message" || Array.isArray(record.content)) {
    const usage = asRecord(record.usage);
    const content = Array.isArray(record.content)
      ? record.content.map((part) => {
          const row = asRecord(part);
          return {
            type: "text" as const,
            text: typeof row.text === "string" ? row.text : "",
          };
        })
      : [{ type: "text" as const, text: "" }];
    return {
      id: typeof record.id === "string" ? record.id : `msg_${crypto.randomUUID().replaceAll("-", "")}`,
      type: "message",
      role: "assistant",
      model: typeof record.model === "string" ? record.model : fallbackModel,
      content,
      stop_reason: typeof record.stop_reason === "string" ? record.stop_reason : "end_turn",
      stop_sequence: typeof record.stop_sequence === "string" ? record.stop_sequence : null,
      usage: {
        input_tokens: Number(usage.input_tokens ?? 0),
        output_tokens: Number(usage.output_tokens ?? 0),
      },
    };
  }

  const usage = asRecord(record.usage);
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const first = asRecord(choices[0]);
  const message = asRecord(first.message);
  const text = typeof message.content === "string" ? message.content : "";
  return {
    id: typeof record.id === "string" ? record.id : `msg_${crypto.randomUUID().replaceAll("-", "")}`,
    type: "message",
    role: "assistant",
    model: typeof record.model === "string" ? record.model : fallbackModel,
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: Number(usage.prompt_tokens ?? usage.input_tokens ?? 0),
      output_tokens: Number(usage.completion_tokens ?? usage.output_tokens ?? 0),
    },
  };
}
