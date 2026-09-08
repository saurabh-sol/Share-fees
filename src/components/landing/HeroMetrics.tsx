const METRICS = [
  { label: "Ratio", value: "50 bps" },
  { label: "Floor", value: "$250" },
  { label: "Daily cap", value: "$2,500" },
] as const;

export function HeroMetrics() {
  return (
    <dl className="mt-8 grid grid-cols-3 divide-x divide-white/8 border-y border-white/8">
      {METRICS.map((item) => (
        <div key={item.label} className="px-3 py-4 text-center md:py-5">
          <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">{item.label}</dt>
          <dd className="mt-1.5 font-mono text-lg tabular-nums tracking-tight text-zinc-100 sm:text-xl">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
