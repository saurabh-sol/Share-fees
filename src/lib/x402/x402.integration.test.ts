import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { PaymentRequiredError, resolveGatewayAuth } from "@/lib/gateway/auth";
import { postChatCompletions } from "@/lib/gateway/http";
import { x402DiscoveryDocument } from "./discovery";

describe("x402 gateway integration", () => {
  const envSnapshot = { ...process.env };

  beforeEach(() => {
    process.env.X402_ENABLED = "true";
    process.env.X402_DEFAULT_MAX_PRICE_USDG = "0.05";
    process.env.X402_RECIPIENT_WALLET = "0x183B3C77F26676E1C12BCA55080d4cA20F7C5a66";
    process.env.MESHGATEWAY_FACILITATOR_URL = "https://facilitator.test";
    process.env.MESHGATEWAY_MERCHANT_ID = "merchant_test";
  });

  afterEach(() => {
    process.env = { ...envSnapshot };
    vi.restoreAllMocks();
  });

  it("returns payment_required 402 when x402 is enabled and no key or payment", async () => {
    await expect(
      resolveGatewayAuth({
        request: new Request("https://example.com/v1/chat/completions"),
        body: {
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "hi" }],
        },
        route: "chat",
      }),
    ).rejects.toBeInstanceOf(PaymentRequiredError);

    const request = new Request("https://example.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    const response = await postChatCompletions(request);
    expect(response.status).toBe(402);
    expect(response.headers.get("payment-required")).toBeTruthy();
    const payload = (await response.json()) as { x402Version?: number; accepts?: unknown[] };
    expect(payload.x402Version).toBe(2);
    expect(Array.isArray(payload.accepts)).toBe(true);
    expect(payload.accepts?.length).toBeGreaterThan(0);
  });

  it("exposes discovery metadata for agents", () => {
    const doc = x402DiscoveryDocument();
    expect(doc.enabled).toBe(true);
    expect(doc.routes.some((route) => route.path === "/v1/chat/completions")).toBe(true);
    expect(doc.models.length).toBeGreaterThan(0);
    expect(doc.payment.network).toContain("4663");
  });
});
