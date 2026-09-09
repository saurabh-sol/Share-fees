"use client";

import type { LlmProvider } from "@/lib/gateway/catalog";
import { PROVIDER_LOGO } from "@/lib/gateway/official-apis";

const FULL_BLEED = new Set<LlmProvider>(["grok", "moonshot", "meta", "perplexity", "cohere"]);

export function ProviderMark({
  provider,
  size = 28,
  className = "",
}: {
  provider: LlmProvider;
  size?: number;
  className?: string;
}) {
  const fullBleed = FULL_BLEED.has(provider);
  const logo = PROVIDER_LOGO[provider];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-white/8 ${
        fullBleed ? "bg-black" : "bg-background"
      } ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={logo}
        alt=""
        width={size}
        height={size}
        className={fullBleed ? "h-full w-full object-contain" : "h-[72%] w-[72%] object-contain"}
      />
    </span>
  );
}
