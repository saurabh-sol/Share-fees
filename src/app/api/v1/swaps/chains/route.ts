import { getSession } from "@/lib/auth/session";
import { fetchLifiChains, type LifiChain } from "@/lib/lifi/http";
import { jsonError } from "@/lib/security/origin";

export const dynamic = "force-dynamic";

const FALLBACK: LifiChain[] = [
  { id: 1, name: "Ethereum", key: "eth" },
  { id: 8453, name: "Base", key: "bas" },
  { id: 42161, name: "Arbitrum", key: "arb" },
  { id: 10, name: "Optimism", key: "opt" },
  { id: 137, name: "Polygon", key: "pol" },
  { id: 4663, name: "Robinhood Chain", key: "hood" },
];

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }
  try {
    const allChains = await fetchLifiChains();
    const hasRobinhood = allChains.some((c) => c.id === 4663);
    const chains = hasRobinhood
      ? allChains
      : [...allChains, { id: 4663, name: "Robinhood Chain", key: "hood" }];
    return Response.json({ chains }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ chains: FALLBACK, degraded: true }, { headers: { "Cache-Control": "private, no-store" } });
  }
}
