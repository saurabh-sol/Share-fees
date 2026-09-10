import { AiCreateError } from "./errors";
import type { AiModelInputSchema } from "./models";

export function validateModelInput(
  schema: AiModelInputSchema,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, field] of Object.entries(schema)) {
    const raw = input[key];
    if (raw === undefined || raw === null || raw === "") {
      if (field.default !== undefined) {
        normalized[key] = field.default;
        continue;
      }
      if (field.required) {
        throw new AiCreateError(`missing_field_${key}`);
      }
      continue;
    }

    if (field.type === "string") {
      if (typeof raw !== "string") {
        throw new AiCreateError(`invalid_field_${key}`);
      }
      const trimmed = raw.trim();
      if (field.required && !trimmed) {
        throw new AiCreateError(`missing_field_${key}`);
      }
      if (field.maxLength && trimmed.length > field.maxLength) {
        throw new AiCreateError(`field_${key}_too_long`);
      }
      if (field.enum && !field.enum.includes(trimmed)) {
        throw new AiCreateError(`invalid_field_${key}`);
      }
      normalized[key] = trimmed;
      continue;
    }

    if (field.type === "number") {
      const num = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(num)) {
        throw new AiCreateError(`invalid_field_${key}`);
      }
      normalized[key] = num;
      continue;
    }

    if (field.type === "boolean") {
      if (typeof raw !== "boolean") {
        throw new AiCreateError(`invalid_field_${key}`);
      }
      normalized[key] = raw;
      continue;
    }

    if (field.type === "array") {
      if (!Array.isArray(raw)) {
        throw new AiCreateError(`invalid_field_${key}`);
      }
      normalized[key] = raw;
    }
  }

  for (const key of Object.keys(input)) {
    if (!(key in schema)) {
      throw new AiCreateError("unknown_input_field");
    }
  }

  return normalized;
}
