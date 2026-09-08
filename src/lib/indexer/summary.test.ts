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

  it("shows reward from total swap volume even if some fills are already credited", () => {
    const summary = summarizeWalletVolume(
      [
        { notionalUsdCents: 20_000, kind: "trade", status: "booked" },
        { notionalUsdCents: 15_000, kind: "trade", status: "below_threshold" },
      ],
      { conversionBps: 50 },
    );
    expect(summary.totalVolumeCents).toBe(35_000);
    expect(summary.qualifiesVolume).toBe(true);
    expect(summary.estimatedTotalRewardCents).toBe(175);
  });

  it("ignores sends and other non-swap kinds when summing volume", () => {
    const summary = summarizeWalletVolume(
      [
        { notionalUsdCents: 18_000, kind: "trade" },
        { notionalUsdCents: 10_000, kind: "send" },
        { notionalUsdCents: 8_000, kind: "execute" },
        { notionalUsdCents: 50_000, kind: "receive" },
      ],
      { conversionBps: 50 },
    );
    expect(summary.transferCount).toBe(4);
    expect(summary.totalVolumeCents).toBe(26_000);
    expect(summary.qualifiesVolume).toBe(true);
    expect(summary.estimatedTotalRewardCents).toBe(130);
  });
});
