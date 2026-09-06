import { PeekAccountButton } from "./PeekAccountButton";

export function AccountStrip() {
  return (
    <section id="account" className="border-t border-white/8">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 md:grid-cols-[1.2fr_0.8fr]">
        <div className="border-b border-white/8 px-4 py-20 md:border-b-0 md:border-r md:px-8 md:py-24">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">[11] Account</p>
          <h2 className="mt-4 max-w-[18ch] text-3xl tracking-tight text-zinc-100 md:text-5xl md:tracking-tighter">
            One wallet. Two rails. Same session address.
          </h2>
          <p className="mt-6 max-w-[58ch] text-base leading-relaxed text-zinc-400">
            Connect once. Credit, USDG, and LLM sit on that address. Peek the desk, then sign. MetaMask, Phantom, and
            Coinbase Wallet are detected from the extension.
          </p>
          <div className="mt-10">
            <PeekAccountButton href="/login" label="Open the desk" />
          </div>
        </div>
        <dl className="divide-y divide-white/8">
          <div className="px-4 py-10 md:px-8">
            <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">Sign-in</dt>
            <dd className="mt-3 text-lg tracking-tight text-zinc-100">SIWE on EVM. SIWS on Solana.</dd>
          </div>
          <div className="px-4 py-10 md:px-8">
            <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">Health</dt>
            <dd className="mt-3 text-lg tracking-tight text-zinc-100">
              <a href="/api/v1/health" className="hover:text-[#c23a3a]">
                GET /api/v1/health
              </a>
            </dd>
          </div>
          <div className="px-4 py-10 md:px-8">
            <dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">Session</dt>
            <dd className="mt-3 text-lg tracking-tight text-zinc-100">No email. No recovery inbox.</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
