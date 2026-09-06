import { describe, expect, it } from "vitest";
import { acquireSharedSlot, rateLimit } from "./rate-limit";

describe("shared provider slot", () => {
  it("lets a burst wait instead of failing immediately", async () => {
    const key = `slot-test-${Date.now()}`;
    const started = Date.now();
    await Promise.all([
      acquireSharedSlot(key, 2, 200, 2_000),
      acquireSharedSlot(key, 2, 200, 2_000),
      acquireSharedSlot(key, 2, 200, 2_000),
    ]);
    expect(Date.now() - started).toBeGreaterThanOrEqual(150);
  });

  it("still hard-caps a single client window", async () => {
    const key = `user-test-${Date.now()}`;
    expect(await rateLimit(key, 1, 60_000)).toBe(true);
    expect(await rateLimit(key, 1, 60_000)).toBe(false);
  });
});
