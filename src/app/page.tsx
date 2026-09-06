import { AccountStrip } from "@/components/landing/AccountStrip";
import { ApiSurface } from "@/components/landing/ApiSurface";
import { CreditCalculator } from "@/components/landing/CreditCalculator";
import { DeskMap } from "@/components/landing/DeskMap";
import { DitherSwapArt } from "@/components/landing/DitherSwapArt";
import { FaqList } from "@/components/landing/FaqList";
import { HowItPays } from "@/components/landing/HowItPays";
import { NotchedCta } from "@/components/landing/NotchedCta";
import { PublishedLimits } from "@/components/landing/PublishedLimits";
import { RulesBoard } from "@/components/landing/RulesBoard";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";

const HOUSES = ["MetaMask", "Phantom", "Coinbase", "LI.FI", "Robinhood"];

export default function HomePage() {
  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main>
        <section className="mx-auto grid min-h-[100dvh] max-w-[1400px] grid-cols-1 items-center gap-10 px-4 py-12 sm:py-16 md:grid-cols-[1.05fr_0.95fr] md:px-8">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
              [01] Wallet-native rewards
            </p>
            <h1 className="mt-6 max-w-[12ch] text-4xl tracking-tighter leading-none text-zinc-100 sm:text-5xl md:text-7xl">
              You swap. We credit.
            </h1>
            <p className="mt-6 max-w-[58ch] text-base leading-relaxed text-zinc-400">
              Qualifying $250+ fills convert at a published ratio. Take USDG to the same wallet, or LLM credits for
              Claude, OpenAI, DeepSeek, and Google-compatible clients.
            </p>
            <div className="mt-10">
              <NotchedCta href="/login">Connect wallet</NotchedCta>
            </div>
            <div className="mt-10">
              <CreditCalculator />
            </div>
            <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
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
              <h2 className="mt-4 text-3xl tracking-tight text-zinc-100">USDG to the same wallet.</h2>
              <p className="mt-4 max-w-[60ch] text-base leading-relaxed text-zinc-400">
                Pick USDG before the credit posts. The outbox queues a payout to the session EVM address on Robinhood.
                No other destination. You redeem from the desk when you want the transfer.
              </p>
            </article>
            <article className="px-4 py-16 md:px-8 md:py-20">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">LLM credits</p>
              <h2 className="mt-4 text-3xl tracking-tight text-zinc-100">A metered key, not a coupon.</h2>
              <p className="mt-4 text-base leading-relaxed text-zinc-400">
                LLM rail mints a t2c_ virtual key. Paste it into any OpenAI-compatible client. Usage burns the credit
                balance. Claude, OpenAI, DeepSeek, and Google marks on the desk control are the same rail.
              </p>
            </article>
          </div>
        </section>

        <DeskMap />
        <PublishedLimits />
        <ApiSurface />
        <RulesBoard />
        <FaqList />
        <AccountStrip />
      </main>
      <SiteFooter />
    </div>
  );
}
