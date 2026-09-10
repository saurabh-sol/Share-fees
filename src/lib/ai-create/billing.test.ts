import { describe, expect, it } from "vitest";
import { computeFinalCostCents } from "./billing";

const job = { reservedCreditCents: 150, estimatedCostCents: 150 };

describe("computeFinalCostCents", () => {
  it("charges zero on failed runs", () => {
    expect(
      computeFinalCostCents(job, {
        id: "p1",
        status: "failed",
        input: {},
        output: null,
        error: "boom",
      }),
    ).toBe(0);
  });

  it("charges zero on canceled runs without metrics", () => {
    expect(
      computeFinalCostCents(job, {
        id: "p2",
        status: "canceled",
        input: {},
        output: null,
        error: null,
      }),
    ).toBe(0);
  });

  it("charges partial on canceled runs with predict_time", () => {
    const cost = computeFinalCostCents(job, {
      id: "p3",
      status: "canceled",
      input: {},
      output: null,
      error: null,
      metrics: { predict_time: 30 },
    });
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThanOrEqual(150);
  });

  it("charges the estimate on success", () => {
    expect(
      computeFinalCostCents(job, {
        id: "p4",
        status: "succeeded",
        input: {},
        output: "https://example.com/out.png",
        error: null,
      }),
    ).toBe(150);
  });
});
