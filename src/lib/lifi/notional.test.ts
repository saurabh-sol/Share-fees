import { describe, expect, it } from "vitest";
import { addressesEqual, usdToCents } from "./notional";
import { assertStatusOwnedBy, extractNotionalCents } from "./settle";

describe("usdToCents", () => {
  it("rounds a LI.FI USD string", () => {
    expect(usdToCents("721.6681")).toBe(72167);
    expect(usdToCents("500")).toBe(50_000);
  });
});

describe("settle guards", () => {
  it("rejects a status owned by another wallet", () => {
    expect(() =>
      assertStatusOwnedBy(
        { status: "DONE", fromAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ),
    ).toThrow("from_address_mismatch");
  });

  it("accepts a matching checksum-insensitive sender", () => {
    expect(() =>
      assertStatusOwnedBy(
        { status: "DONE", fromAddress: "0xAAAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ),
    ).not.toThrow();
  });

  it("reads sending USD first", () => {
    expect(
      extractNotionalCents({
        status: "DONE",
        sending: { amountUSD: "512.77" },
        receiving: { amountUSD: "1.00" },
      }),
    ).toBe(51277);
  });
});

describe("addressesEqual", () => {
  it("ignores case", () => {
    expect(addressesEqual("0xAbc", "0xabc")).toBe(true);
  });
});
