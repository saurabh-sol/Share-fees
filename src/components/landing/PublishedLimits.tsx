const LIMITS = [
  {
    id: "floor",
    label: "Published floor",
    value: "$250",
    body: "A fill below this notional can still settle on-chain. It does not write credit.",
  },
  {
    id: "ratio",
    label: "Conversion",
    value: "50 bps",
    body: "0.50% of qualifying notional. Changing the rule never rewrites booked rows.",
  },
  {
    id: "cap",
    label: "Daily room",
    value: "$2,500",
    body: "Credit that posts in a UTC day stops at this cap. Excess stays visible, unpaid.",
  },
  {
    id: "redeem",
    label: "Minimum redeem",
    value: "$1.00",
    body: "USDT and LLM redeem both start at one dollar. The acc_ cap equals that amount.",
  },
  {
    id: "usdg-claim",
    label: "USDG per claim",
    value: "$5.00",
    body: "Each USDG vault claim is capped at five dollars. A 30-minute cooldown applies per wallet.",
  },
];

export function PublishedLimits() {
  return (
    <section id="limits" className="border-t border-white/8">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-4 py-16 md:grid-cols-[1.2fr_0.8fr] md:px-8 md:py-24">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">[07] Published numbers</p>
          <h2 className="mt-5 max-w-[14ch] text-4xl tracking-tighter leading-none text-zinc-100 md:text-6xl">
            The desk does not hide the ratio.
          </h2>
        </div>
        <p className="max-w-[42ch] self-end text-base leading-relaxed text-zinc-400">
          Floor, bps, and daily cap are the live reward rule. Operators can tighten them. They cannot invent a
          second balance.
        </p>
      </div>

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 border-t border-white/8 md:grid-cols-2">
        {LIMITS.map((item, index) => (
          <article
            key={item.id}
            className={`border-b border-white/8 px-4 py-12 md:px-8 md:py-16 ${
              index % 2 === 0 ? "md:border-r" : ""
            }`}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">{item.label}</p>
            <p className="mt-4 font-mono text-4xl tabular-nums tracking-tighter text-zinc-100 sm:text-5xl md:text-6xl">
              {item.value}
            </p>
            <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-zinc-400">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
