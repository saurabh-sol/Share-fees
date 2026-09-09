import { describe, expect, it } from "vitest";
import { requiredBalanceRaw } from "./balance";
import { HOLDER_MIN_TOKENS, HOLDER_REWARD_CENTS, holderRewardTxHash } from "./constants";

describe("holder verification", () => {
  it("requires one million tokens with 18 decimals", () => {
    expect(requiredBalanceRaw(18)).toBe(BigInt(HOLDER_MIN_TOKENS) * 10n ** 18n);
  });

  it("uses a fixed fifteen dollar reward", () => {
    expect(HOLDER_REWARD_CENTS).toBe(1500);
  });

  it("dedupes holder credits per user", () => {
    expect(holderRewardTxHash("usr_1")).toBe("holder:usr_1");
  });
});
