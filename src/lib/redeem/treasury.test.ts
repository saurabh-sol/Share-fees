import { afterEach, describe, expect, it, vi } from "vitest";

const envState = vi.hoisted(() => ({
  nodeEnv: "test",
  treasuryEnabled: false,
  treasuryDisabled: false,
  treasuryLive: false,
  treasuryPrivateKey: undefined as string | undefined,
  rewardVaultAddress: undefined as string | undefined,
}));

vi.mock("@/lib/env", () => ({
  env: envState,
}));

import { normalizeTreasuryPrivateKey, treasuryCanBroadcast, treasuryCanPayOnChain } from "./treasury";

afterEach(() => {
  envState.nodeEnv = "test";
  envState.treasuryEnabled = false;
  envState.treasuryDisabled = false;
  envState.treasuryLive = false;
  envState.treasuryPrivateKey = undefined;
  envState.rewardVaultAddress = undefined;
});

describe("normalizeTreasuryPrivateKey", () => {
  it("accepts 64 hex with or without 0x", () => {
    const hex = "ab".repeat(32);
    expect(normalizeTreasuryPrivateKey(hex)).toBe(`0x${hex}`);
    expect(normalizeTreasuryPrivateKey(`0x${hex}`)).toBe(`0x${hex}`);
    expect(normalizeTreasuryPrivateKey(` 0x${hex} `)).toBe(`0x${hex}`);
  });

  it("rejects short or junk keys", () => {
    expect(normalizeTreasuryPrivateKey("0xabc")).toBeNull();
    expect(normalizeTreasuryPrivateKey("not-a-key")).toBeNull();
    expect(normalizeTreasuryPrivateKey(undefined)).toBeNull();
  });
});

describe("treasuryCanBroadcast", () => {
  const key = `0x${"cd".repeat(32)}`;

  it("broadcasts locally when a valid key is present", () => {
    envState.nodeEnv = "development";
    envState.treasuryPrivateKey = key;
    expect(treasuryCanBroadcast()).toBe(true);
  });

  it("stays locked locally when TREASURY_ENABLED=false", () => {
    envState.nodeEnv = "development";
    envState.treasuryPrivateKey = key;
    envState.treasuryDisabled = true;
    expect(treasuryCanBroadcast()).toBe(false);
  });

  it("requires enabled and live in production", () => {
    envState.nodeEnv = "production";
    envState.treasuryPrivateKey = key;
    expect(treasuryCanBroadcast()).toBe(false);
    envState.treasuryEnabled = true;
    envState.treasuryLive = true;
    expect(treasuryCanBroadcast()).toBe(true);
  });
});

describe("treasuryCanPayOnChain", () => {
  const key = `0x${"cd".repeat(32)}`;
  const vault = "0x1111111111111111111111111111111111111111";

  it("requires the vault address in addition to a live treasury", () => {
    envState.nodeEnv = "development";
    envState.treasuryPrivateKey = key;
    expect(treasuryCanPayOnChain()).toBe(false);
    envState.rewardVaultAddress = vault;
    expect(treasuryCanPayOnChain()).toBe(true);
  });
});
