import { getSession } from "@/lib/auth/session";
import { fetchLifiTokens, isAllowedChainId, type LifiToken } from "@/lib/lifi/http";
import { isUniswapChainId } from "@/lib/uniswap/constants";
import { ROBINHOOD_CHAIN_ID, ROBINHOOD_USDG } from "@/lib/chains/robinhood";
import { jsonError } from "@/lib/security/origin";

export const dynamic = "force-dynamic";

const ROBINHOOD_TOKENS: LifiToken[] = [
  { address: "0x0000000000000000000000000000000000000000", symbol: "ETH", name: "Ether", decimals: 18, chainId: 4663, priceUSD: undefined, logoURI: undefined },
  { address: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73", symbol: "WETH", name: "Wrapped Ether", decimals: 18, chainId: 4663, priceUSD: undefined, logoURI: undefined },
  { address: ROBINHOOD_USDG, symbol: "USDG", name: "USDG", decimals: 18, chainId: 4663, priceUSD: "1.00", logoURI: undefined },
];

function isSupportedChainId(chainId: number): boolean {
  return isUniswapChainId(chainId) || isAllowedChainId(chainId);
}

const FEATURED_SYMBOLS = ["ETH", "WETH", "USDC", "USDT", "DAI", "POL", "MATIC", "BNB", "WBTC", "ARB", "OP", "USDG"];

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }
  const chainId = Number(new URL(request.url).searchParams.get("chainId"));
  if (!isSupportedChainId(chainId)) {
    return jsonError(400, "unsupported_chain", "That chain is not enabled.");
  }
  try {
    let tokens: LifiToken[];

    if (isAllowedChainId(chainId)) {
      tokens = await fetchLifiTokens(chainId);
      if (chainId === ROBINHOOD_CHAIN_ID && tokens.length < 3) {
        const lifiAddrs = new Set(tokens.map((t) => t.address.toLowerCase()));
        for (const fallback of ROBINHOOD_TOKENS) {
          if (!lifiAddrs.has(fallback.address.toLowerCase())) tokens.push(fallback);
        }
      }
    } else {
      tokens = chainId === ROBINHOOD_CHAIN_ID ? [...ROBINHOOD_TOKENS] : [];
    }

    const featured = tokens.filter((token) => FEATURED_SYMBOLS.includes(token.symbol));
    return Response.json(
      {
        provider: isAllowedChainId(chainId) ? "lifi" : "uniswap",
        tokens: [...featured, ...tokens.filter((token) => !featured.includes(token))].slice(0, 50),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (chainId === ROBINHOOD_CHAIN_ID) {
      return Response.json(
        { provider: "uniswap", tokens: ROBINHOOD_TOKENS },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    return jsonError(502, "tokens_unavailable", error instanceof Error ? error.message : "tokens_unavailable");
  }
}
