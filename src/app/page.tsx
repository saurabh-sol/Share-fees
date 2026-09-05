import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { RatioTape } from "@/components/landing/RatioTape";
import { SiteHeader } from "@/components/landing/SiteHeader";

export default function HomePage() {
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main>
        <section className="mx-auto grid min-h-[100dvh] max-w-[1400px] grid-cols-1 items-center gap-12 px-4 py-16 md:grid-cols-[1.15fr_0.85fr] md:px-8">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#c23a3a]">
              Wallet-native rewards
            </p>
            <h1 className="mt-6 max-w-[16ch] text-4xl tracking-tighter leading-none text-zinc-100 md:text-6xl">
              Swap across chains. Keep the spread as credit.
            </h1>
            <p className="mt-6 max-w-[65ch] text-base leading-relaxed text-zinc-400">
              Qualifying fills from $512.77 and up convert at a published ratio. You choose the rail:
              USDT you can withdraw later, or LLM credits for Claude and OpenAI-compatible tools.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <MagneticButton href="/login">Connect wallet</MagneticButton>
              <MagneticButton href="#mechanics" variant="ghost">
                Read the ratio
              </MagneticButton>
            </div>
            <p className="mt-8 font-mono text-xs text-zinc-500">
              MetaMask · Phantom · Coinbase — detected from the extension, then signed in with SIWE / SIWS.
            </p>
          </div>
          <RatioTape />
        </section>

        <section id="mechanics" className="border-t border-white/8">
          <div className="mx-auto grid max-w-[1400px] grid-cols-1 md:grid-cols-[2fr_1fr]">
            <article className="border-b border-white/8 px-4 py-16 md:border-b-0 md:border-r md:px-8">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">01 — Detect</p>
              <h2 className="mt-4 text-3xl tracking-tight text-zinc-100">A $500+ fill is the only door.</h2>
              <p className="mt-4 max-w-[65ch] text-zinc-400">
                Paper fills in Phase 0, then live LI.FI routes and historical wallet scans. The same rule
                engine prices every tx hash once. Retries do not pay twice.
              </p>
            </article>
            <article className="px-4 py-16 md:px-8">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">02 — Convert</p>
              <h2 className="mt-4 text-3xl tracking-tight text-zinc-100">50 bps, versioned.</h2>
              <p className="mt-4 text-zinc-400">
                $1,842.60 notionally traded writes $9.21 to the ledger. Changing the rule never rewrites old rows.
              </p>
            </article>
          </div>
        </section>

        <section id="rails" className="border-t border-white/8">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-10 px-4 py-20 md:flex-row md:items-end md:justify-between md:px-8">
            <div className="max-w-xl">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Rails</p>
              <h2 className="mt-4 text-3xl tracking-tight text-zinc-100">USDT or LLM credits. You pick before the credit posts.</h2>
              <p className="mt-4 text-zinc-400">
                USDT withdraws to the same wallet on Arbitrum. LLM credits become a metered virtual key
                you paste into any OpenAI-compatible client.
              </p>
            </div>
            <a href="/login" className="inline-flex items-center gap-2 text-sm text-zinc-100">
              Open the desk <ArrowRight size={16} />
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
