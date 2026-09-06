import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LAST_WALLET_KEY,
  forgetWallet,
  readRememberedWallet,
  rememberWallet,
} from "./remember";

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
    },
  });
});

afterEach(() => {
  memory.clear();
});

describe("rememberWallet", () => {
  it("round-trips the last wallet and clears on forget", () => {
    rememberWallet({
      id: "metamask",
      connectorUid: "uid_1",
      kind: "evm",
      address: "0x183b3c77f26676e1c12bca55080d4ca20f7c5a66",
    });
    expect(readRememberedWallet()).toEqual({
      id: "metamask",
      connectorUid: "uid_1",
      kind: "evm",
      address: "0x183b3c77f26676e1c12bca55080d4ca20f7c5a66",
    });
    forgetWallet();
    expect(readRememberedWallet()).toBeNull();
  });

  it("ignores a corrupted payload", () => {
    memory.set(LAST_WALLET_KEY, "{not-json");
    expect(readRememberedWallet()).toBeNull();
  });
});
