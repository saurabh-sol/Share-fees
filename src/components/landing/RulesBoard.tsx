const RULES = [
  {
    title: "No email account",
    body: "The address that signs SIWE or SIWS is the desk. There is no password reset.",
  },
  {
    title: "Same wallet only",
    body: "USDG redeem queues to the session EVM address on Ethereum. No other destination is accepted.",
  },
  {
    title: "One hash, once",
    body: "A (tx, chain) pair credits at most one time. Re-import and retry do not mint a second row.",
  },
  {
    title: "Wash can hold",
    body: "A→B→A on the same wallet inside 60 minutes can hold credit for review. Reject does not pay.",
  },
  {
    title: "Paper fills stay local",
    body: "ALLOW_MOCK_SWAPS is rejected in production. A practice row is not a live chain swap.",
  },
  {
    title: "Key shown once",
    body: "The plaintext t2c_ key is not stored. Leave the page and you mint a new one from remaining credit.",
  },
];

export function RulesBoard() {
  return (
    <section id="rules" className="border-t border-white/8">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 md:grid-cols-[0.9fr_1.1fr]">
        <div className="border-b border-white/8 px-4 py-16 md:border-b-0 md:border-r md:px-8 md:py-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#c23a3a]">[09] Rules</p>
          <h2 className="mt-5 max-w-[12ch] text-4xl tracking-tighter leading-none text-zinc-100 md:text-6xl">
            What the desk will not do.
          </h2>
          <p className="mt-6 max-w-[46ch] text-base leading-relaxed text-zinc-400">
            These are product constraints, not marketing. If a fill fails a rule, the swap can still exist. The
            credit does not.
          </p>
        </div>
        <ul className="divide-y divide-white/8">
          {RULES.map((rule) => (
            <li key={rule.title} className="px-4 py-8 md:px-8">
              <p className="text-lg tracking-tight text-zinc-100">{rule.title}</p>
              <p className="mt-2 max-w-[54ch] text-sm leading-relaxed text-zinc-400">{rule.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
