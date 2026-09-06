const ROWS = [
  { k: "Floor", v: "$250 USD" },
  { k: "Ratio", v: "50 bps" },
  { k: "USDT", v: "Same wallet" },
  { k: "LLM", v: "t2c_ key" },
];

export function FooterTape() {
  return (
    <aside className="relative border border-white/8 bg-[#1c1c1f]/85 px-5 py-6 md:px-6 md:py-7">
      <span className="absolute -left-px -top-px h-3 w-3 border-l border-t border-[#c23a3a]" />
      <span className="absolute -right-px -top-px h-3 w-3 border-r border-t border-[#c23a3a]" />
      <span className="absolute -bottom-px -left-px h-3 w-3 border-b border-l border-[#c23a3a]" />
      <span className="absolute -bottom-px -right-px h-3 w-3 border-b border-r border-[#c23a3a]" />

      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#c23a3a]">[07] Published ratio</p>
      <div className="mt-6 flex items-end justify-between gap-6">
        <div>
          <p className="font-mono text-2xl tracking-tight text-zinc-100">ETH → SOL</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            A live pair, then the credit
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-5xl tabular-nums tracking-tighter text-[#c23a3a]">50</p>
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
      </dl>
    </aside>
  );
}
