"use client";

import { useEffect, useState } from "react";

export function TokenIcon({
  symbol,
  logoURI,
  size = 20,
}: {
  symbol: string;
  logoURI?: string | null;
  size?: number;
}) {
  const fallback = `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${symbol.toLowerCase()}.png`;
  const [src, setSrc] = useState(logoURI || fallback);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(logoURI || fallback);
    setFailed(false);
  }, [logoURI, fallback]);

  if (failed) {
    return (
      <span
        aria-hidden
        className="inline-flex shrink-0 items-center justify-center bg-[#1c1c1f] font-mono text-[10px] uppercase text-zinc-400"
        style={{ width: size, height: size }}
      >
        {symbol.slice(0, 1)}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
      onError={() => {
        if (src !== fallback && logoURI) {
          setSrc(fallback);
          return;
        }
        setFailed(true);
      }}
    />
  );
}
