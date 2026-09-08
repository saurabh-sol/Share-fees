"use client";

import { useEffect, useState } from "react";

const WELL_KNOWN_LOGOS: Record<string, string> = {
  eth: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  weth: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
  usdg: "https://cdn.robinhood.com/ncw_assets/logos/0x5fc5360d0400a0fd4f2af552add042d716f1d168.png",
  usdc: "https://assets.coingecko.com/coins/images/6319/small/usdc.png",
  usdt: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  dai: "https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png",
};

export function TokenIcon({
  symbol,
  logoURI,
  size = 20,
}: {
  symbol: string;
  logoURI?: string | null;
  size?: number;
}) {
  const knownLogo = WELL_KNOWN_LOGOS[symbol.toLowerCase()];
  const cryptoIconsFallback = `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${symbol.toLowerCase()}.png`;
  const safeLogo = logoURI && /^https?:\/\//i.test(logoURI) ? logoURI : null;

  const sources = [safeLogo, knownLogo, cryptoIconsFallback].filter(Boolean) as string[];
  const [srcIdx, setSrcIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrcIdx(0);
    setFailed(false);
  }, [safeLogo, knownLogo]);

  if (failed || sources.length === 0) {
    return (
      <span
        aria-hidden
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-raised font-mono text-[10px] uppercase text-zinc-400"
        style={{ width: size, height: size }}
      >
        {symbol.slice(0, 2)}
      </span>
    );
  }

  return (
    <img
      src={sources[srcIdx]}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full object-contain"
      style={{ width: size, height: size }}
      onError={() => {
        if (srcIdx + 1 < sources.length) {
          setSrcIdx(srcIdx + 1);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}
