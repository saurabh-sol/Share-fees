import Link from "next/link";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "#mechanics", label: "How it pays" },
      { href: "#rails", label: "Rails" },
      { href: "/app/rewards", label: "Rewards" },
      { href: "/app/swap", label: "Swap" },
    ],
  },
  {
    title: "Desk",
    links: [
      { href: "#account", label: "Account" },
      { href: "/login", label: "Sign in" },
      { href: "/app/claims", label: "Activity" },
      { href: "/app/redeem", label: "Redeem" },
    ],
  },
  {
    title: "Rules",
    links: [
      { href: "#mechanics", label: "$250 floor" },
      { href: "#mechanics", label: "50 bps" },
      { href: "#mechanics", label: "Terms" },
      { href: "#mechanics", label: "Privacy" },
    ],
  },
];

export function FooterNav() {
  return (
    <nav aria-label="Footer" className="grid grid-cols-3 gap-6 md:gap-10">
      {COLUMNS.map((column) => (
        <div key={column.title}>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500">{column.title}</p>
          <ul className="mt-5 space-y-3">
            {column.links.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-sm text-zinc-400 transition-colors hover:text-zinc-100 focus-visible:text-zinc-100 focus-visible:outline-none"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
