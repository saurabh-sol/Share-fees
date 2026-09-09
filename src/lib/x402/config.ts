import { robinhoodUSDG, type MerchantConfig } from "@meshgateway/mpp-server";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chains/robinhood";
import { robinhoodChain } from "@/lib/chains/robinhood";
import { env } from "@/lib/env";
import { normalizeTreasuryPrivateKey } from "@/lib/redeem/treasury";

const DEFAULT_RECIPIENT = "0x183B3C77F26676E1C12BCA55080d4cA20F7C5a66" as const;
const DEFAULT_MAX_PRICE_USDG = "0.05";
const DEFAULT_RPC = robinhoodChain.rpcUrls.default.http[0] ?? "https://rpc.mainnet.chain.robinhood.com";

function clean(value: string | undefined) {
  return value?.trim() || undefined;
}

function parseBool(value: string | undefined) {
  return value === "true" || value === "1";
}

export function isX402Enabled() {
  return parseBool(process.env.X402_ENABLED);
}

export function x402RecipientWallet(): `0x${string}` {
  const raw = clean(process.env.X402_RECIPIENT_WALLET) ?? DEFAULT_RECIPIENT;
  return raw as `0x${string}`;
}

export function x402DefaultMaxPriceUsdg() {
  const raw = clean(process.env.X402_DEFAULT_MAX_PRICE_USDG);
  if (!raw) return DEFAULT_MAX_PRICE_USDG;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? raw : DEFAULT_MAX_PRICE_USDG;
}

export function meshgatewayFacilitatorUrl() {
  return clean(process.env.MESHGATEWAY_FACILITATOR_URL);
}

export function meshgatewayMerchantId() {
  return clean(process.env.MESHGATEWAY_MERCHANT_ID);
}

export function x402RelayerKey(): `0x${string}` | null {
  return (
    normalizeTreasuryPrivateKey(clean(process.env.X402_RELAYER_PRIVATE_KEY)) ??
    normalizeTreasuryPrivateKey(env.treasuryPrivateKey)
  );
}

export function x402RpcUrl() {
  return clean(process.env.X402_RPC_URL) ?? clean(process.env.ROBINHOOD_RPC_URL) ?? DEFAULT_RPC;
}

export function x402Configured() {
  if (!isX402Enabled()) return false;
  if (meshgatewayFacilitatorUrl()) return true;
  return Boolean(x402RelayerKey());
}

export function buildMerchantConfig(priceUsdg: string, description?: string): MerchantConfig {
  const relayerKey = x402RelayerKey();
  if (!meshgatewayFacilitatorUrl() && !relayerKey) {
    throw new Error("x402_not_configured");
  }
  return robinhoodUSDG({
    price: priceUsdg,
    recipient: x402RecipientWallet(),
    relayerKey: relayerKey ?? ("0x" + "0".repeat(64)) as `0x${string}`,
    rpcUrl: x402RpcUrl(),
    description,
  });
}

export function x402NetworkId() {
  return `eip155:${ROBINHOOD_CHAIN_ID}`;
}

export function x402OfferMeta(maxPriceUsdg: string) {
  const facilitator = meshgatewayFacilitatorUrl();
  const merchantId = meshgatewayMerchantId();
  return {
    network: x402NetworkId(),
    asset: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
    maxPriceUsdg,
    ...(facilitator ? { facilitator } : {}),
    ...(merchantId ? { merchantId } : {}),
  };
}
