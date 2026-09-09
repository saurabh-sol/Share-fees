import { env } from "@/lib/env";

export const USDG_PAUSE_MESSAGE = "Rewards are paused due to version upgrade.";

export const V2_BANNER_MESSAGE =
  "Backend is upgrading to Accrued v2. Some services may not work. Thanks for your support.";

export class UpgradePausedError extends Error {
  readonly status = 503;
  constructor(message = USDG_PAUSE_MESSAGE) {
    super(message);
    this.name = "UpgradePausedError";
  }
}

export function isAccruedV2Upgrade(): boolean {
  return env.accruedV2Upgrade;
}

export function assertUsdgClaimsOpen(): void {
  if (isAccruedV2Upgrade()) {
    throw new UpgradePausedError();
  }
}
