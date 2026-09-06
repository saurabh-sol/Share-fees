import { describe, expect, it } from "vitest";
import { emptyThread, titleFromPrompt, upsertDeskThread } from "./desk-threads";

describe("desk threads", () => {
  it("titles a session from the first prompt", () => {
    expect(titleFromPrompt("  hello   desk  ")).toBe("hello desk");
    expect(titleFromPrompt("a".repeat(50)).endsWith("…")).toBe(true);
    expect(titleFromPrompt("   ")).toBe("New session");
  });

  it("moves the latest session to the front", () => {
    const first = { ...emptyThread(), id: "a", title: "one" };
    const second = { ...emptyThread(), id: "b", title: "two" };
    const next = upsertDeskThread([first], second);
    expect(next.map((item) => item.id)).toEqual(["b", "a"]);
  });
});
