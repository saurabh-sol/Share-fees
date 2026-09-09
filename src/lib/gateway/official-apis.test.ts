import { describe, expect, it } from "vitest";
import { LLM_PROVIDERS } from "./catalog";
import { OFFICIAL_API_DESK_POINTS, PROVIDER_LOGO } from "./official-apis";

describe("official API desk points", () => {
  it("lists every provider with a logo and vendor host", () => {
    expect(OFFICIAL_API_DESK_POINTS).toHaveLength(LLM_PROVIDERS.length);
    for (const provider of LLM_PROVIDERS) {
      expect(PROVIDER_LOGO[provider]).toMatch(/^\/\w+\.png$/);
      const row = OFFICIAL_API_DESK_POINTS.find((item) => item.provider === provider);
      expect(row?.host).toBeTruthy();
      expect(row?.path).toMatch(/^POST /);
      expect(row?.auth).toBeTruthy();
    }
  });
});
