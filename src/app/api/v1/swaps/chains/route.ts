import { getSession } from "@/lib/auth/session";
import { fetchLifiChains } from "@/lib/lifi/http";
import { jsonError } from "@/lib/security/origin";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }
  try {
    const chains = await fetchLifiChains();
    return Response.json({ chains });
  } catch (error) {
    return jsonError(502, "lifi_unavailable", error instanceof Error ? error.message : "lifi_unavailable");
  }
}
