import { describe, expect, it } from "vitest";
import { ledgerAccountLabel, ledgerReferenceLabel } from "./ledger-labels";

describe("ledger labels", () => {
  it("maps AI generation references", () => {
    expect(ledgerReferenceLabel("ai_create_settle")).toBe("AI generation");
    expect(ledgerAccountLabel("user_llm")).toBe("LLM rail");
  });
});
