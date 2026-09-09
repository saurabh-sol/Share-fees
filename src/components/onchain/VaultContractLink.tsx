import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import {
  SITE_CONTRACT_ADDRESS,
  USDG_REWARD_VAULT,
  robinhoodAddressUrl,
} from "@/lib/chains/robinhood";

export function VaultContractLink({
  compact = false,
  className = "",
  address = USDG_REWARD_VAULT,
  label = "Contract",
}: {
  compact?: boolean;
  className?: string;
  address?: string;
  label?: string;
}) {
  const href = robinhoodAddressUrl(address);
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:text-zinc-100 focus-visible:outline-none ${className}`}
    >
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-200">{compact ? short : address}</span>
      <ArrowSquareOut className="h-3 w-3" weight="regular" />
    </a>
  );
}
