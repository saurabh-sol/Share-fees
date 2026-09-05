import { describe, expect, it } from "vitest";
import { assertPayoutOwnedBy, classifyChangeNowStatus } from "./settle";

describe("ChangeNOW settle guards", () => {
  it("classifies finished vs pending vs failed", () => {
    expect(classifyChangeNowStatus("finished")).toBe("done");
    expect(classifyChangeNowStatus("waiting")).toBe("pending");
    expect(classifyChangeNowStatus("exchanging")).toBe("pending");
    expect(classifyChangeNowStatus("refunded")).toBe("failed");
    expect(classifyChangeNowStatus("expired")).toBe("failed");
  });

  it("rejects a payout owned by another wallet", () => {
    expect(() =>
      assertPayoutOwnedBy(
        {
          id: "abc",
          status: "finished",
          fromCurrency: "eth",
          toCurrency: "eth",
          fromNetwork: "base",
          toNetwork: "hood",
          fromAmount: "0.2",
          toAmount: "0.198",
          payinAddress: "0x1111111111111111111111111111111111111111",
          payoutAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ),
    ).toThrow("payout_address_mismatch");
  });

  it("accepts a matching checksum-insensitive payout", () => {
    expect(() =>
      assertPayoutOwnedBy(
        {
          id: "abc",
          status: "finished",
          fromCurrency: "eth",
          toCurrency: "eth",
          fromNetwork: "eth",
          toNetwork: "hood",
          fromAmount: "0.2",
          toAmount: "0.198",
          payinAddress: "0x1111111111111111111111111111111111111111",
          payoutAddress: "0xAAAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ),
    ).not.toThrow();
  });
});
