import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { BRAND_NAME, pageTitle } from "@/lib/brand";

export const metadata: Metadata = {
  title: pageTitle("Privacy Policy"),
  description: `How ${BRAND_NAME} collects, uses, and protects your information.`,
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

export default function PrivacyPolicyPage() {
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
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-zinc-500">
          Effective date: {EFFECTIVE_DATE}
        </p>
        <P>
          {BRAND_NAME} (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates the{" "}
          <Link href="/" className="text-zinc-100 underline decoration-white/20 underline-offset-4">
            accrued.trade
          </Link>{" "}
          platform (the &ldquo;Service&rdquo;). This Privacy Policy explains how we collect, use,
          disclose, and safeguard your information when you use our Service. By accessing or using the
          Service, you agree to the terms of this Privacy Policy.
        </P>

        {/* 1 */}
        <H2 id="information-we-collect">1. Information We Collect</H2>
        <P>
          We are designed with privacy in mind. There is no email account, no username, and no
          password. We collect only the minimum information necessary to operate the Service.
        </P>
        <h3 className="mt-8 text-lg tracking-tight text-zinc-100">
          1.1 Wallet Information
        </h3>
        <Ul>
          <li>
            <strong className="text-zinc-200">Public wallet address</strong> — We store the Ethereum
            (or other supported chain) address you use to sign in via SIWE (Sign-In with Ethereum).
          </li>
          <li>
            <strong className="text-zinc-200">On-chain transaction data</strong> — We reference
            publicly available blockchain data (transaction hashes, token amounts, timestamps) to
            verify qualifying swaps and calculate credit.
          </li>
        </Ul>
        <h3 className="mt-8 text-lg tracking-tight text-zinc-100">
          1.2 Session Data
        </h3>
        <Ul>
          <li>
            <strong className="text-zinc-200">Encrypted session tokens</strong> — We use
            cryptographically signed session cookies to maintain your authenticated state. These
            contain no personal information beyond your wallet address.
          </li>
        </Ul>
        <h3 className="mt-8 text-lg tracking-tight text-zinc-100">
          1.3 Automatically Collected Information
        </h3>
        <Ul>
          <li>
            <strong className="text-zinc-200">Server logs</strong> — Standard HTTP request metadata
            (IP address, user agent, referrer, timestamps) may be retained for security, rate
            limiting, and abuse prevention.
          </li>
          <li>
            <strong className="text-zinc-200">Performance data</strong> — We may collect anonymized
            metrics (page load times, error rates) to improve reliability.
          </li>
        </Ul>

        {/* 2 */}
        <H2 id="what-we-do-not-collect">2. What We Do Not Collect</H2>
        <P>We want to be explicit about what we never collect:</P>
        <Ul>
          <li>Email addresses, names, phone numbers, or any off-chain personal identifiers.</li>
          <li>Private keys, seed phrases, or wallet passwords.</li>
          <li>Biometric information.</li>
          <li>Location data beyond what an IP address implies.</li>
          <li>Third-party social login data (we do not offer social sign-in).</li>
        </Ul>

        {/* 3 */}
        <H2 id="how-we-use-information">3. How We Use Your Information</H2>
        <P>We use collected information exclusively for the following purposes:</P>
        <Ul>
          <li>
            <strong className="text-zinc-200">Authenticate your session</strong> — Verify wallet
            ownership via cryptographic signature.
          </li>
          <li>
            <strong className="text-zinc-200">Calculate and post credit</strong> — Determine
            qualifying swap volume, apply reward rules, and maintain your ledger balance.
          </li>
          <li>
            <strong className="text-zinc-200">Process redemptions</strong> — Facilitate USDG
            payouts and LLM API key provisioning.
          </li>
          <li>
            <strong className="text-zinc-200">Prevent fraud and abuse</strong> — Rate limiting, wash
            trade detection, and flagging suspicious activity.
          </li>
          <li>
            <strong className="text-zinc-200">Improve the Service</strong> — Diagnose technical
            issues and optimize performance.
          </li>
        </Ul>

        {/* 4 */}
        <H2 id="data-sharing">4. Data Sharing and Disclosure</H2>
        <P>
          We do not sell, rent, or trade your information. We may share data only in the following
          limited circumstances:
        </P>
        <Ul>
          <li>
            <strong className="text-zinc-200">Blockchain interactions</strong> — When you redeem
            USDG, we broadcast a transaction to the relevant blockchain network. Blockchain
            transactions are public by nature.
          </li>
          <li>
            <strong className="text-zinc-200">Third-party service providers</strong> — We use
            infrastructure providers (hosting, databases, caching) that may process data on our
            behalf under strict contractual obligations.
          </li>
          <li>
            <strong className="text-zinc-200">LLM API providers</strong> — When you use LLM credits,
            your API requests are routed through our gateway to the selected model provider (OpenAI,
            Anthropic, Google, etc.). We do not share your wallet address with these providers.
          </li>
          <li>
            <strong className="text-zinc-200">Legal requirements</strong> — We may disclose
            information if required by law, regulation, legal process, or governmental request.
          </li>
        </Ul>

        {/* 5 */}
        <H2 id="third-party-services">5. Third-Party Services</H2>
        <P>The Service integrates with the following third-party services:</P>
        <Ul>
          <li>
            <strong className="text-zinc-200">Privy</strong> — Wallet authentication and session
            management. Subject to{" "}
            <a
              href="https://www.privy.io/privacy-policy"
              target="_blank"
              rel="noreferrer"
              className="text-zinc-100 underline decoration-white/20 underline-offset-4"
            >
              Privy&apos;s Privacy Policy
            </a>
            .
          </li>
          <li>
            <strong className="text-zinc-200">LI.FI / ChangeNOW</strong> — Swap routing and
            execution. Each has its own privacy policy governing transaction processing.
          </li>
          <li>
            <strong className="text-zinc-200">LLM Providers</strong> — API requests are proxied
            through our gateway. Provider privacy policies apply to the content of those requests.
          </li>
        </Ul>

        {/* 6 */}
        <H2 id="data-retention">6. Data Retention</H2>
        <P>
          Ledger entries, swap records, and credit balances are retained for as long as your account
          is active or as needed to provide the Service. Server logs are retained for up to 90 days.
          You may request deletion of your data by contacting us, subject to any legal retention
          obligations.
        </P>

        {/* 7 */}
        <H2 id="security">7. Security</H2>
        <P>
          We implement industry-standard security measures to protect your information, including
          encrypted sessions, secure HTTPS connections, rate limiting, and regular security audits.
          However, no method of transmission over the Internet is 100% secure. We cannot guarantee
          absolute security.
        </P>

        {/* 8 */}
        <H2 id="your-rights">8. Your Rights</H2>
        <P>Depending on your jurisdiction, you may have the right to:</P>
        <Ul>
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of your data.</li>
          <li>Object to or restrict processing of your data.</li>
          <li>Data portability.</li>
        </Ul>
        <P>
          To exercise any of these rights, please contact us using the information provided below.
        </P>

        {/* 9 */}
        <H2 id="cookies">9. Cookies and Local Storage</H2>
        <P>
          We use essential cookies only — specifically, a session cookie to maintain your
          authenticated state. We do not use tracking cookies, advertising cookies, or analytics
          cookies. No data is shared with advertising networks.
        </P>

        {/* 10 */}
        <H2 id="children">10. Children&apos;s Privacy</H2>
        <P>
          The Service is not intended for individuals under the age of 18. We do not knowingly
          collect information from children. If you believe a minor has used our Service, please
          contact us and we will promptly delete any associated data.
        </P>

        {/* 11 */}
        <H2 id="changes">11. Changes to This Policy</H2>
        <P>
          We may update this Privacy Policy from time to time. We will notify you of material changes
          by posting the updated policy on this page with a revised effective date. Your continued use
          of the Service after changes are posted constitutes acceptance of the updated policy.
        </P>

        {/* 12 */}
        <H2 id="contact">12. Contact Us</H2>
        <P>
          If you have questions about this Privacy Policy or wish to exercise your data rights,
          please reach out:
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
              href="/terms"
              className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
            >
              Terms of Service
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
