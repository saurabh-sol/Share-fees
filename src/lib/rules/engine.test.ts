import { describe, expect, it } from "vitest";
import { computeRewardCents } from "./engine";

describe("computeRewardCents", () => {
  it("applies 50 bps on a $764.18 notional", () => {
    expect(computeRewardCents(76418, 50)).toBe(382);
  });

  it("floors fractional cents", () => {
    expect(computeRewardCents(50123, 50)).toBe(250);
  });

  it("rejects invalid bps", () => {
    expect(() => computeRewardCents(50000, 10_001)).toThrow("invalid_conversion_bps");
  });
});
