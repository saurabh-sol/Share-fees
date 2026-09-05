import { assertTxHash } from "@/lib/auth/addresses";
import { MIN_NOTIONAL_USD_CENTS, getActiveRuleOrNull } from "@/lib/rules/engine";
import { persistCandidates } from "./scan";
import { reverifyCandidate } from "./claim";

export async function importHistoricalHash(input: {
  userId: string;
  address: string;
  txHash: string;
  fromChain: string;
  toChain: string;
}) {
  const txHash = assertTxHash("eip155", input.txHash);
  const verified = await reverifyCandidate({
    address: input.address,
    txHash,
    fromChain: input.fromChain,
    toChain: input.toChain,
  });
  const rule = await getActiveRuleOrNull();
  const floor = rule?.minNotionalUsdCents ?? MIN_NOTIONAL_USD_CENTS;
  return persistCandidates(input.userId, [{ ...verified, kind: verified.kind ?? "trade" }], floor);
}
