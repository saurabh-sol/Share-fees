import { isAccruedV2Upgrade, V2_BANNER_MESSAGE } from "@/lib/v2/upgrade";
import { UpgradeBannerClient } from "./UpgradeBannerClient";

export function UpgradeBanner() {
  if (!isAccruedV2Upgrade()) return null;

  return <UpgradeBannerClient message={V2_BANNER_MESSAGE} />;
}
