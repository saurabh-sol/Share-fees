import { describe, expect, it } from "vitest";
import { OriginError, assertSameOrigin, clientIp } from "./origin";

describe("assertSameOrigin", () => {
  it("accepts a matching origin", () => {
    const request = new Request("http://localhost:3000/api/v1/auth/nonce", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });
    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("rejects a foreign origin", () => {
    const request = new Request("http://localhost:3000/api/v1/auth/nonce", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    expect(() => assertSameOrigin(request)).toThrow(OriginError);
  });
});

describe("clientIp", () => {
  it("reads the first forwarded hop only", () => {
    const request = new Request("http://localhost:3000", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    });
    expect(clientIp(request)).toBe("203.0.113.10");
  });
});
