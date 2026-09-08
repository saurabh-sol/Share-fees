import { describe, expect, it, vi } from "vitest";

const envState = vi.hoisted(() => ({
  nodeEnv: "production" as const,
}));

vi.mock("@/lib/env", () => ({
  env: envState,
}));

import { postSwapReward } from "./post-swap-reward";

describe("mock swap guards", () => {
  it("rejects mock fills in production", async () => {
    await expect(
      postSwapReward({
        userId: "user_mock_guard",
        source: "mock",
        txHash: "0x" + "aa".repeat(32),
        fromChain: "ethereum",
        toChain: "arbitrum",
        fromToken: "ETH",
        toToken: "USDC",
        fromAmount: "1",
        toAmount: "3000",
        notionalUsdCents: 300_000,
        executedAt: new Date(),
      }),
    ).rejects.toMatchObject({
      message: "mock_disabled",
      status: 403,
    });
  });
});
