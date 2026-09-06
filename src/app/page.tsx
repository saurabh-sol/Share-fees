import { DitherSwapArt } from "@/components/landing/DitherSwapArt";
import { HowItPays } from "@/components/landing/HowItPays";
import { NotchedCta } from "@/components/landing/NotchedCta";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";

const HOUSES = ["MetaMask", "Phantom", "Coinbase", "LI.FI", "ChangeNOW", "Robinhood"];

export default function HomePage() {
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main>
        <section className="mx-auto grid min-h-[100dvh] max-w-[1400px] grid-cols-1 items-center gap-10 px-4 py-16 md:grid-cols-[1.05fr_0.95fr] md:px-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#c23a3a]">
              [01] Wallet-native rewards
            </p>
            <h1 className="mt-6 max-w-[12ch] text-5xl tracking-tighter leading-none text-zinc-100 md:text-7xl">
              You swap. We credit.
            </h1>
            <p className="mt-6 max-w-[58ch] text-base leading-relaxed text-zinc-400">
              Qualifying $250+ fills convert at a published ratio. Take USDT to the same wallet, or LLM credits for
              Claude, OpenAI, and DeepSeek-compatible clients.
            </p>
            <div className="mt-10">
              <NotchedCta href="/login">Connect wallet</NotchedCta>
            </div>
            <p className="mt-14 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              Detected from the extension · signed with SIWE / SIWS
            </p>
          </div>
          <DitherSwapArt />
        </section>

        <section className="border-t border-white/8">
          <div className="mx-auto grid max-w-[1400px] grid-cols-2 md:grid-cols-6">
            {HOUSES.map((name) => (
              <div
                key={name}
                className="border-b border-white/8 px-4 py-6 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500 odd:border-r md:border-b-0 md:border-r md:last:border-r-0"
              >
                {name}
              </div>
            ))}
          </div>
        </section>

        <HowItPays />

        <section id="rails" className="border-t border-white/8">
          <div className="mx-auto grid max-w-[1400px] grid-cols-1 md:grid-cols-[1.15fr_0.85fr]">
            <article className="border-b border-white/8 px-4 py-16 md:border-b-0 md:border-r md:px-8 md:py-20">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">[05] Rails</p>
              <h2 className="mt-4 text-3xl tracking-tight text-zinc-100">USDT to the same wallet.</h2>
              <p className="mt-4 max-w-[60ch] text-base leading-relaxed text-zinc-400">
                Pick USDT before the credit posts. The outbox queues a payout to the session EVM address on Arbitrum.
                No other destination. You redeem from the desk when you want the transfer.
              </p>
            </article>
            <article className="px-4 py-16 md:px-8 md:py-20">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">LLM credits</p>
              <h2 className="mt-4 text-3xl tracking-tight text-zinc-100">A metered key, not a coupon.</h2>
              <p className="mt-4 text-base leading-relaxed text-zinc-400">
                LLM rail mints a t2c_ virtual key. Paste it into any OpenAI-compatible client. Usage burns the credit
                balance. Claude, OpenAI, and DeepSeek marks on the desk control are the same rail.
              </p>
            </article>
          </div>
        </section>

        <section id="account" className="border-t border-white/8">
          <div className="mx-auto max-w-[1400px] px-4 py-20 pb-28 md:px-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">Account</p>
            <h2 className="mt-4 max-w-[18ch] text-3xl tracking-tight text-zinc-100">
              One wallet. Two rails. Same session address.
            </h2>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
