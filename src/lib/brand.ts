/** Public product identity — import instead of hard-coding Accrued in UI and copy. */
export const BRAND_NAME = "Accrued" as const;
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

export function pageTitle(section: string) {
  return `${section} — ${BRAND_NAME}`;
}

export function docsPageTitle(page: string) {
  return `${page} — ${BRAND_NAME} Docs`;
}
