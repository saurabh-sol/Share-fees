import { describe, expect, it } from "vitest";
import { summarizeWalletVolume } from "./summary";

describe("summarizeWalletVolume", () => {
  it("lists volume and withholds reward under the $250 floor", () => {
    const summary = summarizeWalletVolume(
      [
        { notionalUsdCents: 10_000 },
        { notionalUsdCents: 8_000 },
        { notionalUsdCents: 5_000 },
      ],
      { conversionBps: 50 },
    );
    expect(summary.transferCount).toBe(3);
    expect(summary.totalVolumeCents).toBe(23_000);
    expect(summary.qualifiesVolume).toBe(false);
    expect(summary.estimatedTotalRewardCents).toBe(0);
  });

  it("mentions total reward once scanned volume clears $250", () => {
    const summary = summarizeWalletVolume(
      [
        { notionalUsdCents: 12_000 },
        { notionalUsdCents: 10_000 },
        { notionalUsdCents: 8_000 },
      ],
      { conversionBps: 50 },
    );
    expect(summary.totalVolumeCents).toBe(30_000);
    expect(summary.qualifiesVolume).toBe(true);
    expect(summary.estimatedTotalRewardCents).toBe(150);
  });
});
