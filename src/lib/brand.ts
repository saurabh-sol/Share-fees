/** Public product identity — import instead of hard-coding Accrued in UI and copy. */
export const BRAND_NAME = "Accrued" as const;
/** Canonical production origin — SIWE domain, OG metadata, and LLM gateway base URL. */
export const PRODUCTION_APP_ORIGIN = "https://accrued.trade" as const;
/** Public LLM gateway base for docs, copy blocks, and SDK examples (always production). */
export const PUBLIC_GATEWAY_V1_URL = `${PRODUCTION_APP_ORIGIN}/v1` as const;
export const BRAND_TAGLINE = "You swap. We credit." as const;
export const BRAND_DESCRIPTION =
  "Qualifying swaps convert at a published ratio into USDG or LLM credits — same wallet, one desk." as const;
/** Square mark in /public — used in headers, footer, favicon, and metadata. */
export const BRAND_LOGO_PATH = "/logo.png" as const;
export const BRAND_TITLE = `${BRAND_NAME} — ${BRAND_TAGLINE}` as const;
export const SIWE_STATEMENT = `${BRAND_NAME} wants to connect your wallet` as const;

/** Prefix for metered LLM virtual keys (shown once at redeem). */
export const VIRTUAL_KEY_PREFIX = "acc_" as const;
/** Legacy prefix — still accepted at the gateway for keys minted before rebrand. */
export const LEGACY_VIRTUAL_KEY_PREFIX = "t2c_" as const;

export function isVirtualKey(raw: string): boolean {
  return raw.startsWith(VIRTUAL_KEY_PREFIX) || raw.startsWith(LEGACY_VIRTUAL_KEY_PREFIX);
}

export const RESPONSE_HEADER_REMAINING = "X-Accrued-Remaining-Cents";
export const RESPONSE_HEADER_PROVIDER = "X-Accrued-Provider";
export const RESPONSE_HEADER_SPEND_CAP = "X-Accrued-Spend-Cap-Cents";
/** Plain Robinhood Chain tx hash after a settled x402 payment. */
export const RESPONSE_HEADER_X402_TX = "X-Accrued-X402-Tx-Hash";
/** Payer wallet that signed the Permit2 authorization. */
export const RESPONSE_HEADER_X402_PAYER = "X-Accrued-X402-Payer";
/** "true" when x402 verify + settle succeeded for this request. */
export const RESPONSE_HEADER_X402_SETTLED = "X-Accrued-X402-Settled";

export function pageTitle(section: string) {
  return section;
}

export function docsPageTitle(page: string) {
  return page;
}
