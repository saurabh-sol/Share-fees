import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyReplicateWebhook } from "./webhook";

const SECRET = "whsec_" + Buffer.from("test-signing-key-1234567890").toString("base64");

function sign(body: string, secret = SECRET) {
  const webhookId = "msg_test_1";
  const webhookTimestamp = String(Math.floor(Date.now() / 1000));
  const signedContent = `${webhookId}.${webhookTimestamp}.${body}`;
  const key = Buffer.from(secret.slice("whsec_".length), "base64");
  const signature = createHmac("sha256", key).update(signedContent).digest("base64");
  return {
    webhookId,
    webhookTimestamp,
    webhookSignature: `v1,${signature}`,
    body,
  };
}

describe("verifyReplicateWebhook", () => {
  it("accepts a valid signature", () => {
    const payload = JSON.stringify({ id: "pred_1", status: "succeeded" });
    const signed = sign(payload);
    expect(
      verifyReplicateWebhook(signed.body, {
        webhookId: signed.webhookId,
        webhookTimestamp: signed.webhookTimestamp,
        webhookSignature: signed.webhookSignature,
      }, SECRET),
    ).toBe(true);
  });

  it("rejects tampered bodies", () => {
    const signed = sign(JSON.stringify({ id: "pred_1", status: "succeeded" }));
    expect(
      verifyReplicateWebhook('{"id":"pred_1","status":"failed"}', {
        webhookId: signed.webhookId,
        webhookTimestamp: signed.webhookTimestamp,
        webhookSignature: signed.webhookSignature,
      }, SECRET),
    ).toBe(false);
  });
});
