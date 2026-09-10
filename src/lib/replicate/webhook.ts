import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE_SECONDS = 300;

function decodeSigningKey(secret: string): Buffer {
  const trimmed = secret.trim();
  const raw = trimmed.startsWith("whsec_") ? trimmed.slice("whsec_".length) : trimmed;
  return Buffer.from(raw, "base64");
}

function parseWebhookSignatures(header: string): string[] {
  return header
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.includes(",") ? part.split(",", 2)[1]! : part));
}

export function verifyReplicateWebhook(
  rawBody: string,
  headers: {
    webhookId: string | null;
    webhookTimestamp: string | null;
    webhookSignature: string | null;
  },
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  const { webhookId, webhookTimestamp, webhookSignature } = headers;
  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return false;
  }

  const timestamp = Number.parseInt(webhookTimestamp, 10);
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > MAX_AGE_SECONDS) {
    return false;
  }

  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expected = createHmac("sha256", decodeSigningKey(secret))
    .update(signedContent)
    .digest("base64");

  const candidates = parseWebhookSignatures(webhookSignature);
  return candidates.some((candidate) => {
    try {
      const left = Buffer.from(candidate);
      const right = Buffer.from(expected);
      return left.length === right.length && timingSafeEqual(left, right);
    } catch {
      return false;
    }
  });
}
