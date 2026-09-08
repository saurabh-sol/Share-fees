import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { BRAND_NAME, pageTitle } from "@/lib/brand";

export const metadata: Metadata = {
  title: pageTitle("Terms of Service"),
  description: `Terms and conditions governing your use of the ${BRAND_NAME} platform.`,
};

const EFFECTIVE_DATE = "September 9, 2026";

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="mt-14 scroll-mt-28 border-t border-white/8 pt-10 text-2xl tracking-tight text-zinc-100"
    >
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-zinc-400">{children}</p>;
}

function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-4 max-w-[65ch] list-disc space-y-2 pl-5 text-base leading-relaxed text-zinc-400">
      {children}
    </ul>
  );
}

function Ol({ children }: { children: React.ReactNode }) {
  return (
    <ol className="mt-4 max-w-[65ch] list-decimal space-y-2 pl-5 text-base leading-relaxed text-zinc-400">
      {children}
    </ol>
  );
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-white/8 px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-[800px] items-center justify-between">
          <Link href="/">
            <BrandMark size="lg" />
          </Link>
          <Link
            href="/docs"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 transition-colors hover:text-zinc-100"
          >
            Docs
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[800px] px-4 py-16 md:px-8 md:py-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Legal</p>
        <h1 className="mt-4 text-4xl tracking-tighter leading-none text-zinc-100 md:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-4 text-sm text-zinc-500">
          Effective date: {EFFECTIVE_DATE}
        </p>
        <P>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the{" "}
          {BRAND_NAME} platform available at{" "}
          <Link href="/" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
            accrued.trade
          </Link>{" "}
          (the &ldquo;Service&rdquo;), operated by {BRAND_NAME} (&ldquo;we,&rdquo; &ldquo;us,&rdquo;
          or &ldquo;our&rdquo;). By accessing or using the Service, you agree to be bound by these
          Terms. If you do not agree, do not use the Service.
        </P>

        {/* 1 */}
        <H2 id="eligibility">1. Eligibility</H2>
        <P>To use the Service, you must:</P>
        <Ul>
          <li>Be at least 18 years of age or the age of majority in your jurisdiction.</li>
          <li>Have the legal capacity to enter into a binding agreement.</li>
          <li>
            Not be prohibited from using the Service under any applicable law or regulation,
            including but not limited to sanctions, anti-money laundering, or export control laws.
          </li>
          <li>Have access to a compatible Ethereum or supported blockchain wallet.</li>
        </Ul>

        {/* 2 */}
        <H2 id="account-and-access">2. Account and Access</H2>
        <P>
          The Service uses wallet-based authentication. There is no email, username, or password.
          Your wallet address serves as your unique identifier.
        </P>
        <Ul>
          <li>
            <strong className="text-zinc-200">Wallet security</strong> — You are solely responsible
            for the security of your wallet, private keys, and seed phrase. We never have access to
            your private keys.
          </li>
          <li>
            <strong className="text-zinc-200">Session authority</strong> — Any action performed
            during an authenticated session tied to your wallet address is considered authorized by
            you.
          </li>
          <li>
            <strong className="text-zinc-200">One address, one desk</strong> — Each wallet address
            corresponds to a single desk. Balances, credits, and history are bound to the signing
            address.
          </li>
        </Ul>

        {/* 3 */}
        <H2 id="the-service">3. Description of the Service</H2>
        <P>
          {BRAND_NAME} is a wallet-native rewards desk. The Service allows users to:
        </P>
        <Ol>
          <li>
            <strong className="text-zinc-200">Swap tokens</strong> — Execute qualifying token swaps
            through integrated routing providers.
          </li>
          <li>
            <strong className="text-zinc-200">Earn credit</strong> — Qualifying swaps convert at a
            published ratio into website credit.
          </li>
          <li>
            <strong className="text-zinc-200">Redeem credit</strong> — Convert credit to USDG
            (on-chain payout) or LLM API credits for use with supported AI model providers.
          </li>
          <li>
            <strong className="text-zinc-200">Use LLM API keys</strong> — Metered API keys
            compatible with OpenAI, Anthropic, Google, DeepSeek, and Grok endpoints.
          </li>
        </Ol>

        {/* 4 */}
        <H2 id="credit-and-rewards">4. Credit and Reward Rules</H2>
        <Ul>
          <li>
            <strong className="text-zinc-200">Qualifying swaps</strong> — Not all swaps earn credit.
            A swap must meet the minimum notional threshold, be on a supported chain, and not
            duplicate a previously credited transaction.
          </li>
          <li>
            <strong className="text-zinc-200">Published ratios</strong> — The credit-to-swap ratio
            is published on the platform. We reserve the right to change the ratio at any time.
            Changes apply prospectively and do not affect previously posted credit.
          </li>
          <li>
            <strong className="text-zinc-200">Minimum floor</strong> — Certain actions (e.g. USDG
            redemption) may require a minimum confirmed swap volume before becoming available.
          </li>
          <li>
            <strong className="text-zinc-200">No guarantee of value</strong> — Credit is a
            platform-internal balance. It is not a token, security, or financial instrument.
            It has no value outside the Service.
          </li>
        </Ul>

        {/* 5 */}
        <H2 id="usdg-redemption">5. USDG Redemption</H2>
        <P>
          USDG payouts are processed on-chain to the wallet address associated with your session.
        </P>
        <Ul>
          <li>
            Redemptions are subject to processing time and blockchain network conditions.
          </li>
          <li>
            Once a transaction is broadcast to the blockchain, it cannot be reversed, cancelled, or
            refunded.
          </li>
          <li>
            We are not responsible for errors caused by incorrect wallet addresses, network
            congestion, or third-party infrastructure failures.
          </li>
          <li>
            Minimum and maximum redemption limits may apply and are published on the platform.
          </li>
        </Ul>

        {/* 6 */}
        <H2 id="llm-credits">6. LLM API Credits</H2>
        <Ul>
          <li>
            LLM credits are metered. Each API request consumes credit based on the model and token
            usage.
          </li>
          <li>
            API keys are issued once and cannot be recovered if lost. You are responsible for
            storing your keys securely.
          </li>
          <li>
            We route requests through our gateway and do not guarantee the uptime, accuracy, or
            availability of third-party model providers.
          </li>
          <li>
            Usage is subject to the rate limits and content policies of the underlying model
            providers.
          </li>
        </Ul>

        {/* 7 */}
        <H2 id="prohibited-conduct">7. Prohibited Conduct</H2>
        <P>You agree not to:</P>
        <Ul>
          <li>
            Engage in wash trading, self-dealing, or any activity designed to artificially inflate
            swap volume or credit balance.
          </li>
          <li>
            Use bots, scripts, or automated tools to interact with the Service in a manner that
            circumvents rate limits or fair use policies.
          </li>
          <li>
            Attempt to exploit, hack, or reverse-engineer any part of the Service, smart contracts,
            or associated infrastructure.
          </li>
          <li>
            Use the Service for money laundering, terrorist financing, sanctions evasion, or any
            other illegal purpose.
          </li>
          <li>
            Interfere with the operation of the Service or impose an unreasonable load on our
            infrastructure.
          </li>
          <li>
            Impersonate another wallet address or misrepresent your identity.
          </li>
        </Ul>
        <P>
          Violation of these rules may result in immediate suspension, credit forfeiture, and
          permanent ban from the Service without prior notice.
        </P>

        {/* 8 */}
        <H2 id="intellectual-property">8. Intellectual Property</H2>
        <P>
          All content, code, design, trademarks, and intellectual property associated with the
          Service are owned by {BRAND_NAME} or its licensors. You are granted a limited,
          non-exclusive, non-transferable license to use the Service for its intended purpose. You
          may not copy, modify, distribute, or create derivative works from any part of the Service
          without prior written consent.
        </P>

        {/* 9 */}
        <H2 id="third-party-services">9. Third-Party Services</H2>
        <P>
          The Service integrates with third-party providers for swap routing, wallet authentication,
          and AI model access. We are not responsible for the availability, accuracy, or policies of
          these third-party services. Your use of such services is subject to their respective terms
          and conditions.
        </P>

        {/* 10 */}
        <H2 id="disclaimers">10. Disclaimers</H2>
        <P>
          THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT
          WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY, OR OTHERWISE. WE DISCLAIM
          ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY,
          FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        </P>
        <P>
          We do not warrant that the Service will be uninterrupted, error-free, or secure. We do not
          warrant the accuracy or completeness of any information provided through the Service.
          Cryptocurrency and blockchain transactions carry inherent risks. You acknowledge and accept
          these risks.
        </P>

        {/* 11 */}
        <H2 id="limitation-of-liability">11. Limitation of Liability</H2>
        <P>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, {BRAND_NAME} AND ITS OFFICERS, DIRECTORS,
          EMPLOYEES, AGENTS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
          SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS,
          DATA, TOKENS, OR DIGITAL ASSETS, ARISING FROM OR IN CONNECTION WITH YOUR USE OF THE
          SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
        </P>
        <P>
          OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING FROM OR RELATED TO THE SERVICE SHALL
          NOT EXCEED THE AMOUNT OF CREDIT POSTED TO YOUR ACCOUNT IN THE PRECEDING 12 MONTHS.
        </P>

        {/* 12 */}
        <H2 id="indemnification">12. Indemnification</H2>
        <P>
          You agree to indemnify, defend, and hold harmless {BRAND_NAME} and its affiliates from and
          against any claims, damages, losses, liabilities, costs, and expenses (including reasonable
          attorneys&apos; fees) arising from your use of the Service, violation of these Terms, or
          infringement of any third-party rights.
        </P>

        {/* 13 */}
        <H2 id="modifications">13. Modifications to Terms</H2>
        <P>
          We may revise these Terms at any time by posting the updated version on this page with a
          new effective date. Material changes will be communicated through the platform. Your
          continued use of the Service after the effective date of any revision constitutes acceptance
          of the updated Terms.
        </P>

        {/* 14 */}
        <H2 id="termination">14. Termination</H2>
        <P>
          We may suspend or terminate your access to the Service at any time, with or without cause,
          and with or without notice. Upon termination, your right to use the Service ceases
          immediately. Any pending redemptions may be processed or cancelled at our discretion.
          Provisions that by their nature should survive termination (including disclaimers,
          limitations of liability, and indemnification) shall survive.
        </P>

        {/* 15 */}
        <H2 id="governing-law">15. Governing Law</H2>
        <P>
          These Terms shall be governed by and construed in accordance with applicable law, without
          regard to conflict of law principles. Any disputes arising under these Terms shall be
          resolved through binding arbitration or in the courts of competent jurisdiction.
        </P>

        {/* 16 */}
        <H2 id="severability">16. Severability</H2>
        <P>
          If any provision of these Terms is found to be invalid, illegal, or unenforceable, the
          remaining provisions shall continue in full force and effect.
        </P>

        {/* 17 */}
        <H2 id="contact">17. Contact</H2>
        <P>
          If you have questions about these Terms, please contact us through the platform:
        </P>
        <Ul>
          <li>
            <strong className="text-zinc-200">Platform</strong>:{" "}
            <Link
              href="/"
              className="text-zinc-100 underline decoration-white/20 underline-offset-4"
            >
              accrued.trade
            </Link>
          </li>
        </Ul>

        <div className="mt-14 border-t border-white/8 pt-8">
          <p className="text-sm text-zinc-500">
            © 2026 {BRAND_NAME}. All rights reserved.
          </p>
          <div className="mt-3 flex gap-6">
            <Link
              href="/privacy"
              className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              Privacy Policy
            </Link>
            <Link
              href="/docs"
              className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              Documentation
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
