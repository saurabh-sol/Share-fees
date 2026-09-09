import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { encodeBase64Json } from "@meshgateway/mpp-server";
import { PaymentRequiredError, resolveGatewayAuth } from "@/lib/gateway/auth";
import { postChatCompletions } from "@/lib/gateway/http";
import { RESPONSE_HEADER_X402_SETTLED, RESPONSE_HEADER_X402_TX } from "@/lib/brand";
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

  it("returns 402 when payment header is present but invalid", async () => {
    const badHeader = encodeBase64Json({ payload: { signature: "0x00" } });
    await expect(
      resolveGatewayAuth({
        request: new Request("https://example.com/v1/chat/completions", {
          headers: { "payment-signature": badHeader },
        }),
        body: {
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "hi" }],
        },
        route: "chat",
      }),
    ).rejects.toBeInstanceOf(PaymentRequiredError);
  });

  it("returns settlement receipt headers after a mocked facilitator settle", async () => {
    const txHash = "0x" + "aa".repeat(32);
    const payer = "0x" + "bb".repeat(20);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { paymentPayload?: unknown };
        if (!body.paymentPayload) {
          return Response.json({ isValid: false, invalidReason: "missing_payload" }, { status: 400 });
        }
        const path = String(_url);
        if (path.endsWith("/verify")) {
          return Response.json({ isValid: true, payer });
        }
        if (path.endsWith("/settle")) {
          return Response.json({ success: true, transaction: txHash, payer });
        }
        return Response.json({}, { status: 404 });
      }),
    );

    const paymentHeader = encodeBase64Json({
      payload: {
        permit2Authorization: {
          permitted: { token: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", amount: "50000" },
          from: payer,
          spender: "0x402085c248EeA27D92E8b30b2C58ed07f9E20001",
          nonce: "1",
          deadline: String(Math.floor(Date.now() / 1000) + 3600),
          witness: { to: "0x183B3C77F26676E1C12BCA55080d4cA20F7C5a66", validAfter: "0" },
        },
        signature: "0x" + "cc".repeat(65),
      },
    });

    const auth = await resolveGatewayAuth({
      request: new Request("https://example.com/v1/chat/completions", {
        headers: { "payment-signature": paymentHeader },
      }),
      body: {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "hi" }],
      },
      route: "chat",
    });

    expect(auth.mode).toBe("x402");
    if (auth.mode !== "x402") return;
    expect(auth.txHash).toBe(txHash);
    expect(auth.responseHeaders[RESPONSE_HEADER_X402_TX]).toBe(txHash);
    expect(auth.responseHeaders[RESPONSE_HEADER_X402_SETTLED]).toBe("true");
    expect(auth.responseHeaders["payment-response"]).toBeTruthy();
  });
});
