export type DocsHeading = {
  id: string;
  title: string;
};

export type DocsPage = {
  href: string;
  title: string;
  description: string;
  section: string;
  keywords: string[];
  headings: DocsHeading[];
};

export type DocsGroup = {
  title: string;
  items: DocsPage[];
};

export const DOCS_PAGES: DocsPage[] = [
  {
    href: "/docs",
    title: "Introduction",
    description: "What Trade2Credits is, who it is for, and how credit moves from a swap to a rail.",
    section: "Start here",
    keywords: ["t2c", "trade2credits", "overview", "wallet", "credit"],
    headings: [
      { id: "what-it-is", title: "What it is" },
      { id: "who-it-is-for", title: "Who it is for" },
      { id: "the-walk", title: "The walk" },
      { id: "three-balances", title: "Three balances, one ledger" },
    ],
  },
  {
    href: "/docs/how-it-pays",
    title: "How it pays",
    description: "The six steps from a signed-in wallet to posted credit.",
    section: "Start here",
    keywords: ["bps", "floor", "volume", "claim", "convert"],
    headings: [
      { id: "the-six-steps", title: "The six steps" },
      { id: "worked-example", title: "Worked example" },
      { id: "what-counts", title: "What counts as volume" },
    ],
  },
  {
    href: "/docs/connect",
    title: "Connect a wallet",
    description: "SIWE and SIWS sign-in. There is no email account.",
    section: "Start here",
    keywords: ["login", "metamask", "phantom", "siwe", "siws", "session"],
    headings: [
      { id: "sign-in", title: "Sign in" },
      { id: "supported-wallets", title: "Supported wallets" },
      { id: "what-the-session-binds", title: "What the session binds" },
    ],
  },
  {
    href: "/docs/swap",
    title: "Swap Studio",
    description: "Quote and execute a live fill through LI.FI or Robinhood ETH.",
    section: "The desk",
    keywords: ["swap", "lifi", "robinhood", "quote", "held"],
    headings: [
      { id: "run-a-fill", title: "Run a fill" },
      { id: "below-the-floor", title: "Below the floor" },
      { id: "pairs-lifi-cannot-quote", title: "Pairs LI.FI cannot quote" },
    ],
  },
  {
    href: "/docs/activity",
    title: "Activity",
    description: "Scan 90 days of transfers or import a hash, then claim website credit.",
    section: "The desk",
    keywords: ["scan", "zerion", "import", "hash", "claim", "history"],
    headings: [
      { id: "scan-the-wallet", title: "Scan the wallet" },
      { id: "import-a-hash", title: "Import a hash" },
      { id: "claim", title: "Claim" },
    ],
  },
  {
    href: "/docs/balances",
    title: "Balances and convert",
    description: "Website credit, the USDG rail, and the LLM rail. Convert is 1:1.",
    section: "The desk",
    keywords: ["convert", "desk", "website credit", "rail"],
    headings: [
      { id: "the-three-numbers", title: "The three numbers" },
      { id: "convert", title: "Convert" },
      { id: "review-before-it-posts", title: "Review before it posts" },
    ],
  },
  {
    href: "/docs/chat",
    title: "Chat",
    description: "Talk to a model on the desk without minting a key.",
    section: "The desk",
    keywords: ["chat", "desk chat", "model"],
    headings: [
      { id: "when-to-use-chat", title: "When to use Chat" },
      { id: "when-to-mint-a-key", title: "When to mint a key" },
    ],
  },
  {
    href: "/docs/ledger",
    title: "Ledger",
    description: "Every credit, convert, and redeem writes an immutable row.",
    section: "The desk",
    keywords: ["ledger", "log", "fills", "reference"],
    headings: [
      { id: "rows", title: "Rows" },
      { id: "fills", title: "Fills" },
    ],
  },
  {
    href: "/docs/usdg",
    title: "USDG",
    description: "On-chain vault claim on Robinhood Chain to the signed-in EVM address.",
    section: "Take credit",
    keywords: ["usdg", "robinhood", "vault", "claim", "payout"],
    headings: [
      { id: "what-you-receive", title: "What you receive" },
      { id: "how-a-claim-lands", title: "How a claim lands" },
      { id: "limits", title: "Limits" },
      { id: "queued", title: "Queued, not paid" },
    ],
  },
  {
    href: "/docs/llm",
    title: "LLM credits",
    description: "Redeem a metered t2c_ key for OpenAI, Anthropic, DeepSeek, Google, or Grok.",
    section: "Take credit",
    keywords: ["t2c", "key", "openai", "anthropic", "deepseek", "google", "grok", "xai"],
    headings: [
      { id: "mint-a-key", title: "Mint a key" },
      { id: "shown-once", title: "Shown once" },
      { id: "revoke", title: "Revoke" },
    ],
  },
  {
    href: "/docs/api",
    title: "API",
    description: "Point the official vendor SDK at this origin. Usage burns remaining cents.",
    section: "Take credit",
    keywords: ["api", "sdk", "baseurl", "completions", "messages"],
    headings: [
      { id: "openai-deepseek-grok", title: "OpenAI, DeepSeek, and Grok" },
      { id: "anthropic", title: "Anthropic" },
      { id: "google", title: "Google" },
      { id: "errors", title: "Errors" },
    ],
  },
  {
    href: "/docs/limits",
    title: "Published numbers",
    description: "Floor, ratio, daily cap, redeem minimum, and USDG claim cap.",
    section: "Rules",
    keywords: ["250", "50 bps", "2500", "cap", "floor"],
    headings: [
      { id: "live-rule", title: "The live rule" },
      { id: "what-cannot-change", title: "What cannot change after a row posts" },
    ],
  },
  {
    href: "/docs/rules",
    title: "What the desk will not do",
    description: "Product constraints, not marketing.",
    section: "Rules",
    keywords: ["wash", "duplicate", "destination", "paper fill"],
    headings: [
      { id: "constraints", title: "Constraints" },
      { id: "holds", title: "Holds" },
    ],
  },
  {
    href: "/docs/faq",
    title: "FAQ",
    description: "Short answers before you connect.",
    section: "Rules",
    keywords: ["faq", "questions", "help"],
    headings: [
      { id: "who", title: "Who can use it" },
      { id: "pay", title: "When a swap pays" },
      { id: "old-hash", title: "Old hashes" },
      { id: "after-redeem", title: "After redeem" },
    ],
  },
];

export const DOCS_GROUPS: DocsGroup[] = (() => {
  const order = ["Start here", "The desk", "Take credit", "Rules"];
  return order.map((title) => ({
    title,
    items: DOCS_PAGES.filter((page) => page.section === title),
  }));
})();

export function getDocsPage(href: string): DocsPage | undefined {
  return DOCS_PAGES.find((page) => page.href === href);
}

export function getDocsNeighbors(href: string): {
  prev: DocsPage | null;
  next: DocsPage | null;
} {
  const index = DOCS_PAGES.findIndex((page) => page.href === href);
  return {
    prev: index > 0 ? DOCS_PAGES[index - 1]! : null,
    next: index >= 0 && index < DOCS_PAGES.length - 1 ? DOCS_PAGES[index + 1]! : null,
  };
}

export function searchDocs(query: string): DocsPage[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return DOCS_PAGES.filter((page) => {
    const hay = [page.title, page.description, page.section, ...page.keywords, ...page.headings.map((h) => h.title)]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
