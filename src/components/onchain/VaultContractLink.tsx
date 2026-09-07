import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { USDG_REWARD_VAULT, robinhoodAddressUrl } from "@/lib/chains/robinhood";

export function VaultContractLink({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  const href = robinhoodAddressUrl(USDG_REWARD_VAULT);
  const short = `${USDG_REWARD_VAULT.slice(0, 6)}…${USDG_REWARD_VAULT.slice(-4)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:text-zinc-100 focus-visible:outline-none ${className}`}
    >
      <span className="text-zinc-500">Contract</span>
      <span className="text-zinc-200">{compact ? short : USDG_REWARD_VAULT}</span>
      <ArrowSquareOut className="h-3 w-3" weight="regular" />
    </a>
  );
}
