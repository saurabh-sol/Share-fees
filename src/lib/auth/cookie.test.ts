import { describe, expect, it } from "vitest";
import { SESSION_COOKIE, readCookie } from "./cookie";

describe("readCookie", () => {
  it("reads the named cookie from a header", () => {
    expect(readCookie(`other=1; ${SESSION_COOKIE}=abc%2Edef; x=y`, SESSION_COOKIE)).toBe("abc.def");
  });

  it("returns undefined when the cookie is missing", () => {
    expect(readCookie("other=1", SESSION_COOKIE)).toBeUndefined();
    expect(readCookie(null, SESSION_COOKIE)).toBeUndefined();
  });
});
