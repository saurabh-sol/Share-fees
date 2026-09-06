import { getSession } from "@/lib/auth/session";
import { NATIVE_TOKEN, ROBINHOOD_CHAIN_ID, robinhoodChain } from "@/lib/chains/robinhood";
import { fetchLifiChains, type LifiChain } from "@/lib/lifi/http";
import { jsonError } from "@/lib/security/origin";

export const dynamic = "force-dynamic";

const ROBINHOOD: LifiChain = {
  id: ROBINHOOD_CHAIN_ID,
  name: robinhoodChain.name,
  key: "hood",
  nativeToken: { symbol: "ETH", decimals: 18, address: NATIVE_TOKEN },
};

const FALLBACK: LifiChain[] = [
  { id: 1, name: "Ethereum", key: "eth" },
  { id: 8453, name: "Base", key: "bas" },
  { id: 42161, name: "Arbitrum", key: "arb" },
  { id: 10, name: "Optimism", key: "opt" },
  ROBINHOOD,
];

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }
  try {
    const chains = await fetchLifiChains();
    return Response.json({ chains }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ chains: FALLBACK, degraded: true }, { headers: { "Cache-Control": "private, no-store" } });
  }
}
