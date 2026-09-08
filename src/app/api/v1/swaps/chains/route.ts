import { getSession } from "@/lib/auth/session";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chains/robinhood";
import { jsonError } from "@/lib/security/origin";

export const dynamic = "force-dynamic";

/**
 * Swap Studio is Robinhood-Chain only. Uniswap (V4 + V3) via the Universal
 * Router is the routing surface. Cross-chain bridging is disabled — trades
 * stay on Robinhood Chain (id 4663) so any ERC-20 token pair with Uniswap
 * liquidity is swappable, including tokenized stocks.
 */
export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }

  return Response.json(
    {
      chains: [
        {
          id: ROBINHOOD_CHAIN_ID,
          name: "Robinhood Chain",
          key: "hood",
        },
      ],
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
