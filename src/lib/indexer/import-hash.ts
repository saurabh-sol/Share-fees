import { assertTxHash } from "@/lib/auth/addresses";
import { getActiveRule } from "@/lib/rules/engine";
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
  const rule = await getActiveRule();
  if (verified.notionalUsdCents < rule.minNotionalUsdCents) {
    throw new Error("below_threshold");
  }
  return persistCandidates(input.userId, [verified], rule.minNotionalUsdCents);
}
