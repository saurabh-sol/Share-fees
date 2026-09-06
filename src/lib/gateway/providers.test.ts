import { afterEach, describe, expect, it } from "vitest";
import { env } from "@/lib/env";
import { aiGatewayAuth, aiGatewayHeaders, poolKeyFor, providerReady } from "./providers";

const snapshot = {
  aiGatewayApiKey: env.aiGatewayApiKey,
  vercelOidcToken: env.vercelOidcToken,
  openaiApiKey: env.openaiApiKey,
  anthropicApiKey: env.anthropicApiKey,
  deepseekApiKey: env.deepseekApiKey,
  googleApiKey: env.googleApiKey,
};

afterEach(() => {
  env.aiGatewayApiKey = snapshot.aiGatewayApiKey;
  env.vercelOidcToken = snapshot.vercelOidcToken;
  env.openaiApiKey = snapshot.openaiApiKey;
  env.anthropicApiKey = snapshot.anthropicApiKey;
  env.deepseekApiKey = snapshot.deepseekApiKey;
  env.googleApiKey = snapshot.googleApiKey;
});

describe("upstream auth", () => {
  it("treats AI Gateway as enough for every provider", () => {
    env.aiGatewayApiKey = "gw_test";
    env.vercelOidcToken = undefined;
    env.openaiApiKey = undefined;
    env.anthropicApiKey = undefined;
    env.deepseekApiKey = undefined;
    env.googleApiKey = undefined;
    expect(aiGatewayAuth()).toBe("gw_test");
    expect(providerReady("openai")).toBe(true);
    expect(providerReady("anthropic")).toBe(true);
    expect(providerReady("deepseek")).toBe(true);
    expect(providerReady("google")).toBe(true);
    expect(poolKeyFor("openai")).toBeUndefined();
  });

  it("sends OIDC as x-vercel-oidc-token and API keys as Bearer", () => {
    env.aiGatewayApiKey = undefined;
    env.vercelOidcToken = "eyJhbGciOiJIUzI1NiJ9.e30.sig";
    expect(aiGatewayHeaders()).toEqual({
      "x-vercel-oidc-token": "eyJhbGciOiJIUzI1NiJ9.e30.sig",
    });
    env.aiGatewayApiKey = "gw_live";
    expect(aiGatewayHeaders()).toEqual({ authorization: "Bearer gw_live" });
  });

  it("falls back to a single provider pool key when Gateway is unset", () => {
    env.aiGatewayApiKey = undefined;
    env.vercelOidcToken = undefined;
    env.openaiApiKey = "sk-test";
    env.anthropicApiKey = undefined;
    env.deepseekApiKey = undefined;
    env.googleApiKey = undefined;
    expect(aiGatewayAuth()).toBe("");
    expect(providerReady("openai")).toBe(true);
    expect(providerReady("anthropic")).toBe(false);
    expect(providerReady("google")).toBe(false);
    env.googleApiKey = "AIza-test";
    expect(providerReady("google")).toBe(true);
    expect(poolKeyFor("google")).toBe("AIza-test");
  });
});
