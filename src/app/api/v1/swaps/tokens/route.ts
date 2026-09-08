import { getSession } from "@/lib/auth/session";
import type { LifiToken } from "@/lib/lifi/http";
import {
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_STOCKS,
  ROBINHOOD_USDG,
  ROBINHOOD_WETH,
} from "@/lib/chains/robinhood";
import { jsonError } from "@/lib/security/origin";

export const dynamic = "force-dynamic";

/**
 * Ordered token list for Robinhood Chain.
 * Stocks come first so users land on equity trading by default.
 * USDG is the quote currency for all stock pairs.
 */
function buildRobinhoodTokens(): LifiToken[] {
  const stocks: LifiToken[] = ROBINHOOD_STOCKS.map((s) => ({
    address: s.address,
    symbol: s.symbol,
    name: s.name,
    decimals: 18,
    chainId: ROBINHOOD_CHAIN_ID,
    priceUSD: undefined,
    logoURI: s.logoURI,
  }));

  const stables: LifiToken[] = [
    {
      address: ROBINHOOD_USDG,
      symbol: "USDG",
      name: "Global Dollar",
      decimals: 18,
      chainId: ROBINHOOD_CHAIN_ID,
      priceUSD: "1.00",
      logoURI: "https://cdn.robinhood.com/ncw_assets/logos/0x5fc5360d0400a0fd4f2af552add042d716f1d168.png",
    },
  ];

  const gas: LifiToken[] = [
    {
      address: "0x0000000000000000000000000000000000000000",
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      chainId: ROBINHOOD_CHAIN_ID,
      priceUSD: undefined,
      logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    },
    {
      address: ROBINHOOD_WETH,
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      chainId: ROBINHOOD_CHAIN_ID,
      priceUSD: undefined,
      logoURI: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
    },
  ];

  // Stocks first — the point of the platform.
  // Then USDG (the quote), then ETH/WETH (gas + wrapped).
  return [...stocks, ...stables, ...gas];
}

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }

  const chainId = Number(new URL(request.url).searchParams.get("chainId"));
  if (chainId !== ROBINHOOD_CHAIN_ID) {
    return jsonError(
      400,
      "unsupported_chain",
      "Swap Studio runs only on Robinhood Chain (id 4663). Switch your wallet network.",
    );
  }

  return Response.json(
    {
      provider: "uniswap",
      tokens: buildRobinhoodTokens(),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
