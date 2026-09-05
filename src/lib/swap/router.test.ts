import { describe, expect, it } from "vitest";
import { involvesRobinhood } from "@/lib/changenow/assets";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chains/robinhood";

describe("swap router", () => {
  it("sends any Robinhood hop to ChangeNOW", () => {
    expect(involvesRobinhood(1, ROBINHOOD_CHAIN_ID)).toBe(true);
    expect(involvesRobinhood(ROBINHOOD_CHAIN_ID, 42161)).toBe(true);
    expect(involvesRobinhood(8453, 42161)).toBe(false);
  });
});
