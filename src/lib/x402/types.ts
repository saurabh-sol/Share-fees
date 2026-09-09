import type { PaymentRequirements } from "@meshgateway/mpp-server";
import type { LlmProvider } from "@/lib/gateway/catalog";

export type X402SettlementStatus = "settled" | "recorded" | "failed";

export type X402VerifiedPayment = {
  txHash: `0x${string}`;
  payer: `0x${string}`;
  amountUsdg: string;
  requirements: PaymentRequirements;
  responseHeader: string;
};

export type X402AuthContext = {
  mode: "x402";
  payer: `0x${string}`;
  txHash: `0x${string}`;
  maxPriceUsdg: string;
  provider: LlmProvider;
  model: string;
  responseHeaders: Record<string, string>;
};

export type VirtualKeyAuthContext = {
  mode: "virtualKey";
  key: {
    id: string;
    keyHash: string;
    provider: LlmProvider;
    model: string | null;
    remainingCents: number;
    spendCapCents: number;
    spendUsedCents: number;
  };
};

export type GatewayAuthContext = VirtualKeyAuthContext | X402AuthContext;

export type X402RouteKind = "chat" | "messages" | "generate";

export type X402OfferMeta = {
  network: string;
  asset: string;
  maxPriceUsdg: string;
  facilitator?: string;
  merchantId?: string;
};
