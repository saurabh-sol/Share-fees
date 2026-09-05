import { addressesEqual, usdToCents } from "./notional";
import { fetchLifiStatus, type LifiStatus } from "./http";

export class SettleError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "SettleError";
  }
}

export function extractNotionalCents(status: LifiStatus): number {
  const raw = status.sending?.amountUSD ?? status.receiving?.amountUSD;
  if (!raw) {
    throw new SettleError("missing_usd_notional", 422);
  }
  return usdToCents(raw);
}

export function assertStatusOwnedBy(status: LifiStatus, sessionAddress: string) {
  if (!status.fromAddress) {
    throw new SettleError("missing_from_address", 422);
  }
  if (!addressesEqual(status.fromAddress, sessionAddress)) {
    throw new SettleError("from_address_mismatch", 403);
  }
}

export async function readVerifiedFill(input: {
  txHash: string;
  fromChain?: string;
  toChain?: string;
  sessionAddress: string;
}) {
  const status = await fetchLifiStatus({
    txHash: input.txHash,
    fromChain: input.fromChain,
    toChain: input.toChain,
  });

  if (status.status === "NOT_FOUND" || status.status === "PENDING") {
    return { kind: "pending" as const, status };
  }
  if (status.status === "FAILED") {
    throw new SettleError("swap_failed", 400);
  }
  if (status.status !== "DONE") {
    return { kind: "pending" as const, status };
  }

  assertStatusOwnedBy(status, input.sessionAddress);
  const notionalUsdCents = extractNotionalCents(status);
  return {
    kind: "done" as const,
    status,
    notionalUsdCents,
    fromToken: status.sending?.token?.symbol ?? status.sending?.token?.address ?? "unknown",
    toToken: status.receiving?.token?.symbol ?? status.receiving?.token?.address ?? "unknown",
    fromAmount: status.sending?.amount ?? "0",
    toAmount: status.receiving?.amount ?? "0",
    fromChain: input.fromChain ?? String(status.sending?.token?.chainId ?? "unknown"),
    toChain: input.toChain ?? String(status.receiving?.token?.chainId ?? "unknown"),
    executedHash: status.sending?.txHash ?? input.txHash,
  };
}
