"use client";

import { OpenAiLogo } from "@phosphor-icons/react";
import type { LlmProvider } from "@/lib/gateway/catalog";

const IMAGE_MARK: Partial<Record<LlmProvider, string>> = {
  anthropic: "/claude.png",
  deepseek: "/deepseek.png",
  google: "/gemini.png",
  grok: "/grok.png",
};

export function ProviderMark({
  provider,
  size = 28,
  className = "",
}: {
  provider: LlmProvider;
  size?: number;
  className?: string;
}) {
  const iconSize = Math.round(size * 0.62);
  const grok = provider === "grok";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-white/8 ${
        grok ? "bg-black" : "bg-background"
      } ${className}`}
      style={{ width: size, height: size }}
    >
      {provider === "openai" ? (
        <OpenAiLogo size={iconSize} weight="regular" className="text-zinc-100" />
      ) : (
        <img
          src={IMAGE_MARK[provider]}
          alt=""
          width={size}
          height={size}
          className={grok ? "h-full w-full object-contain" : "h-[72%] w-[72%] object-contain"}
        />
      )}
    </span>
  );
}
