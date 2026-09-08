import { USDG_REWARD_VAULT, robinhoodAddressUrl } from "@/lib/chains/robinhood";

const ROWS = [
  { k: "Floor", v: "$250 USD" },
  { k: "Ratio", v: "50 bps" },
  { k: "USDG", v: "Vault claim" },
  { k: "LLM", v: "acc_ key" },
];

export function FooterTape() {
  const vaultHref = robinhoodAddressUrl(USDG_REWARD_VAULT);
  const vaultShort = `${USDG_REWARD_VAULT.slice(0, 6)}…${USDG_REWARD_VAULT.slice(-4)}`;

  return (
    <aside className="relative border border-white/8 bg-raised/85 px-5 py-6 md:px-6 md:py-7">
      <span className="absolute -left-px -top-px h-3 w-3 border-l border-t border-accent" />
      <span className="absolute -right-px -top-px h-3 w-3 border-r border-t border-accent" />
      <span className="absolute -bottom-px -left-px h-3 w-3 border-b border-l border-accent" />
      <span className="absolute -bottom-px -right-px h-3 w-3 border-b border-r border-accent" />

      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">[07] Published ratio</p>
      <div className="mt-6 flex items-end justify-between gap-6">
        <div>
          <p className="font-mono text-2xl tracking-tight text-zinc-100">ETH → USDG</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            A live pair, then the credit
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-5xl tabular-nums tracking-tighter text-accent">50</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">bps out</p>
        </div>
      </div>

      <dl className="mt-8 divide-y divide-white/8 border-t border-white/8">
        {ROWS.map((row) => (
          <div key={row.k} className="flex items-center justify-between gap-4 py-3">
            <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">{row.k}</dt>
            <dd className="font-mono text-sm tabular-nums text-zinc-200">{row.v}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">Contract</dt>
          <dd>
            <a
              href={vaultHref}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-sm tabular-nums text-zinc-200 underline-offset-4 hover:text-zinc-50 hover:underline"
            >
              {vaultShort}
            </a>
          </dd>
        </div>
      </dl>
    </aside>
  );
}
