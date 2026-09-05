export const LIFI_INTEGRATOR = "Trade2Credits";

export const ALLOWED_CHAIN_IDS = [1, 10, 56, 137, 42161, 8453, 43114, 59144, 534352, 81457] as const;
export type AllowedChainId = (typeof ALLOWED_CHAIN_IDS)[number];

export function isAllowedChainId(value: number): value is AllowedChainId {
  return (ALLOWED_CHAIN_IDS as readonly number[]).includes(value);
}
