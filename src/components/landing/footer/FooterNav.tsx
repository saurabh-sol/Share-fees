import Link from "next/link";
import { USDG_REWARD_VAULT, robinhoodAddressUrl } from "@/lib/chains/robinhood";

const COLUMNS: Array<{
  title: string;
  links: Array<{ href: string; label: string; external?: boolean }>;
}> = [
  {
    title: "Product",
    links: [
      { href: "/docs", label: "Docs" },
      { href: "/docs/how-it-pays", label: "How it pays" },
      { href: "/docs/api", label: "LLM API" },
      { href: "/app/swap", label: "Swap" },
    ],
  },
  {
    title: "Desk",
    links: [
      { href: "#desk", label: "Four pages" },
      { href: "/login", label: "Sign in" },
      { href: "/app/claims", label: "Activity" },
      { href: "/app/redeem", label: "Redeem" },
    ],
  },
  {
    title: "Rules",
    links: [
      { href: "#limits", label: "Limits" },
      { href: "#rules", label: "Will not do" },
      { href: "/docs/faq", label: "FAQ" },
      { href: "/api/v1/health", label: "Health" },
      { href: robinhoodAddressUrl(USDG_REWARD_VAULT), label: "Contract", external: true },
    ],
  },
];

const linkClass =
  "text-sm text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:text-zinc-100 focus-visible:outline-none";

export function FooterNav() {
  return (
    <nav aria-label="Footer" className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6 md:gap-10">
      {COLUMNS.map((column) => (
        <div key={column.title}>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">{column.title}</p>
          <ul className="mt-5 space-y-3">
            {column.links.map((link) => (
              <li key={link.label}>
                {link.external ? (
                  <a href={link.href} target="_blank" rel="noreferrer" className={linkClass}>
                    {link.label}
                  </a>
                ) : (
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
