import { getSession } from "@/lib/auth/session";
import { readAccrBalance } from "@/lib/holder/balance";
import { HOLDER_MIN_TOKENS, HOLDER_REWARD_CENTS, HOLDER_HOLD_MS } from "@/lib/holder/constants";
import { getHolderStatus } from "@/lib/holder/service";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }

  const [status, balance] = await Promise.all([
    getHolderStatus(session.user.id),
    readAccrBalance(session.user.address).catch(() => null),
  ]);

  return Response.json({
    walletAddress: session.user.address,
    requiredTokens: HOLDER_MIN_TOKENS,
    rewardCents: HOLDER_REWARD_CENTS,
    holdMs: HOLDER_HOLD_MS,
    balance: balance
      ? {
          human: balance.balanceHuman,
          meetsRequirement: balance.meetsRequirement,
        }
      : null,
    ...status,
  });
}
