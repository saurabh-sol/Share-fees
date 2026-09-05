import { getSession } from "@/lib/auth/session";
import { isSwapChainId, robinhoodTokens } from "@/lib/changenow/assets";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chains/robinhood";
import { fetchLifiTokens, isAllowedChainId } from "@/lib/lifi/http";
import { jsonError } from "@/lib/security/origin";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }
  const chainId = Number(new URL(request.url).searchParams.get("chainId"));
  if (!isSwapChainId(chainId)) {
    return jsonError(400, "unsupported_chain", "That chain is not enabled.");
  }
  try {
    if (chainId === ROBINHOOD_CHAIN_ID) {
      return Response.json({ tokens: await robinhoodTokens(), provider: "changenow" });
    }
    if (!isAllowedChainId(chainId)) {
      return jsonError(400, "unsupported_chain", "That chain is not enabled.");
    }
    const tokens = await fetchLifiTokens(chainId);
    const featured = tokens.filter((token) =>
      ["ETH", "WETH", "USDC", "USDT", "DAI", "POL", "MATIC", "BNB", "WBTC"].includes(token.symbol),
    );
    return Response.json({
      provider: "lifi",
      tokens: [...featured, ...tokens.filter((token) => !featured.includes(token))].slice(0, 40),
    });
  } catch (error) {
    return jsonError(502, "tokens_unavailable", error instanceof Error ? error.message : "tokens_unavailable");
  }
}
