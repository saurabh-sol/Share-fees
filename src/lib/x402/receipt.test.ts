import { describe, expect, it } from "vitest";
import { encodeBase64Json } from "@meshgateway/mpp-server";
import {
  RESPONSE_HEADER_X402_PAYER,
  RESPONSE_HEADER_X402_SETTLED,
  RESPONSE_HEADER_X402_TX,
} from "@/lib/brand";
import { readX402Receipt, x402ReceiptHeaders } from "./receipt";

describe("x402 receipt", () => {
  it("builds plain and standard receipt headers", () => {
    const txHash = "0x" + "ab".repeat(32);
    const payer = "0x" + "cd".repeat(20);
    const paymentResponseHeader = encodeBase64Json({
      success: true,
      transaction: txHash,
      payer,
      network: "eip155:4663",
    });
    const headers = x402ReceiptHeaders({ txHash, payer, paymentResponseHeader });
    expect(headers[RESPONSE_HEADER_X402_SETTLED]).toBe("true");
    expect(headers[RESPONSE_HEADER_X402_TX]).toBe(txHash);
    expect(headers[RESPONSE_HEADER_X402_PAYER]).toBe(payer);
    expect(headers["payment-response"]).toBe(paymentResponseHeader);
  });

  it("reads receipt from response headers", () => {
    const txHash = "0x" + "11".repeat(32);
    const payer = "0x" + "22".repeat(20);
    const response = new Response("{}", {
      headers: x402ReceiptHeaders({
        txHash,
        payer,
        paymentResponseHeader: encodeBase64Json({
          success: true,
          transaction: txHash,
          payer,
          network: "eip155:4663",
        }),
      }),
    });
    const receipt = readX402Receipt(response);
    expect(receipt?.success).toBe(true);
    expect(receipt?.transaction).toBe(txHash);
    expect(receipt?.payer).toBe(payer);
    expect(receipt?.explorerUrl).toContain(txHash);
  });
});
