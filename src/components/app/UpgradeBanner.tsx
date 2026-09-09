import { isAccruedV2Upgrade, V2_BANNER_MESSAGE } from "@/lib/v2/upgrade";

export function UpgradeBanner() {
  if (!isAccruedV2Upgrade()) return null;

  return (
    <div
      role="status"
      className="border-b border-amber-500/25 bg-amber-500/10 px-4 py-2.5 text-center font-mono text-[11px] leading-relaxed tracking-[0.04em] text-amber-100/95"
    >
      {V2_BANNER_MESSAGE}
    </div>
  );
}
