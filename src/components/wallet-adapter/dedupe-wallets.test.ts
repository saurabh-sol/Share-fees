import { describe, expect, it } from "vitest";
import { dedupeWallets, walletFamilyKey } from "./dedupe-wallets";

describe("walletFamilyKey", () => {
  it("collapses every MetaMask connector shape into one family", () => {
    expect(walletFamilyKey({ rdns: "io.metamask", name: "MetaMask" })).toBe("family:metamask");
    expect(walletFamilyKey({ rdns: "", name: "MetaMask" })).toBe("family:metamask");
    expect(walletFamilyKey({ rdns: "", name: "Injected", id: "io.metamask" })).toBe(
      "family:metamask",
    );
    expect(walletFamilyKey({ rdns: "io.metamask.mobile", name: "MetaMask" })).toBe(
      "family:metamask",
    );
  });

  it("keeps Flask as its own family", () => {
    expect(walletFamilyKey({ rdns: "io.metamask.flask", name: "MetaMask Flask" })).toBe(
      "family:metamask-flask",
    );
  });
});

describe("dedupeWallets", () => {
  it("never lists MetaMask more than once", () => {
    const result = dedupeWallets([
      { id: "uid-1", name: "MetaMask", rdns: "io.metamask", iconUrl: "data:fox" },
      { id: "uid-2", name: "MetaMask", rdns: "", iconUrl: null },
      { id: "uid-3", name: "MetaMask", rdns: null, iconUrl: "data:other" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("uid-1");
    expect(result[0]?.iconUrl).toBe("data:fox");
  });

  it("keeps different wallets", () => {
    const result = dedupeWallets([
      { id: "mm", name: "MetaMask", rdns: "io.metamask" },
      { id: "ph", name: "Phantom", rdns: "app.phantom" },
      { id: "cb", name: "Coinbase Wallet", rdns: "com.coinbase.wallet" },
    ]);
    expect(result.map((w) => w.name)).toEqual(["Coinbase Wallet", "MetaMask", "Phantom"]);
  });
});
