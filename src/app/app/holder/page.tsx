import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HolderVerifyDesk } from "@/components/app/HolderVerifyDesk";
import { getSession } from "@/lib/auth/session";
import { readAccrBalance } from "@/lib/holder/balance";
import { HOLDER_HOLD_MS, HOLDER_MIN_TOKENS, HOLDER_REWARD_CENTS } from "@/lib/holder/constants";
import { getHolderStatus } from "@/lib/holder/service";
import { pageTitle } from "@/lib/brand";

export const metadata: Metadata = {
  title: pageTitle("Verify holder"),
  description: "Hold 1.8M $ACCR for 1 hour to earn $3 website credit.",
};

export default async function HolderPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [status, balance] = await Promise.all([
    getHolderStatus(session.user.id),
    readAccrBalance(session.user.address).catch(() => null),
  ]);

  return (
    <HolderVerifyDesk
      initial={{
        walletAddress: session.user.address,
        requiredTokens: HOLDER_MIN_TOKENS,
        rewardCents: HOLDER_REWARD_CENTS,
        holdMs: HOLDER_HOLD_MS,
        balance: balance
          ? { human: balance.balanceHuman, meetsRequirement: balance.meetsRequirement }
          : null,
        ...status,
      }}
    />
  );
}
