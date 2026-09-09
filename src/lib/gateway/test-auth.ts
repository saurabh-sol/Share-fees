import type { GatewayAuthContext } from "@/lib/x402/types";
import { authenticateVirtualKey } from "./service";

type Db = Parameters<typeof authenticateVirtualKey>[1];

export async function virtualKeyAuthContext(raw: string, db?: Db): Promise<GatewayAuthContext> {
  const key = await authenticateVirtualKey(raw, db);
  return {
    mode: "virtualKey",
    key: {
      id: key.id,
      keyHash: key.keyHash,
      provider: key.provider,
      model: key.model,
      remainingCents: key.remainingCents,
      spendCapCents: key.spendCapCents,
      spendUsedCents: key.spendUsedCents,
    },
  };
}
