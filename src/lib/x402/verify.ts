import {
  PAYMENT_RESPONSE_HEADER,
  PAYMENT_SIGNATURE_HEADER,
  decodeBase64Json,
  settlementResponseHeader,
  verifyAndSettle,
  type MerchantConfig,
  type PaymentRequirements,
} from "@meshgateway/mpp-server";
import { buildMerchantConfig, meshgatewayFacilitatorUrl, meshgatewayMerchantId } from "./config";
import type { X402VerifiedPayment } from "./types";

export function readPaymentHeader(request: Request) {
  return (
    request.headers.get(PAYMENT_SIGNATURE_HEADER) ??
    request.headers.get("x-payment") ??
    request.headers.get("X-Payment")
  );
}

function decodePaymentPayload(header: string) {
  return decodeBase64Json<{
    x402Version?: number;
    payload?: {
      permit2Authorization?: unknown;
      signature?: string;
    };
  }>(header);
}

async function facilitatorPost(path: "verify" | "settle", body: unknown) {
  const base = meshgatewayFacilitatorUrl();
  if (!base) {
    throw new Error("facilitator_not_configured");
  }
  const merchantId = meshgatewayMerchantId();
  const response = await fetch(`${base.replace(/\/$/, "")}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(merchantId ? { "X-Mesh-Merchant-Id": merchantId } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const reason =
      (typeof json.invalidReason === "string" && json.invalidReason) ||
      (typeof json.errorReason === "string" && json.errorReason) ||
      (typeof json.error === "string" && json.error) ||
      `facilitator_${path}_failed`;
    throw new Error(reason);
  }
  return json;
}

async function verifyViaFacilitator(
  request: Request,
  requirements: PaymentRequirements,
  config: MerchantConfig,
  priceUsdg: string,
): Promise<X402VerifiedPayment | null> {
  const header = readPaymentHeader(request);
  if (!header) return null;

  let paymentPayload: unknown;
  try {
    paymentPayload = decodePaymentPayload(header);
  } catch {
    throw new Error("malformed_payment_header");
  }

  const verifyResult = (await facilitatorPost("verify", {
    paymentPayload,
    paymentRequirements: requirements,
  })) as { isValid?: boolean; success?: boolean; payer?: string; invalidReason?: string };

  const valid = verifyResult.isValid === true || verifyResult.success === true;
  if (!valid) {
    throw new Error(verifyResult.invalidReason ?? "payment_verification_failed");
  }

  const settleResult = (await facilitatorPost("settle", {
    paymentPayload,
    paymentRequirements: requirements,
  })) as {
    success?: boolean;
    transaction?: string;
    txHash?: string;
    payer?: string;
    errorReason?: string;
  };

  if (settleResult.success === false) {
    throw new Error(settleResult.errorReason ?? "payment_settlement_failed");
  }

  const txHash = (settleResult.transaction ?? settleResult.txHash) as `0x${string}` | undefined;
  const payer = settleResult.payer as `0x${string}` | undefined;
  if (!txHash || !payer) {
    throw new Error("incomplete_settlement_response");
  }

  return {
    txHash,
    payer,
    amountUsdg: priceUsdg,
    requirements,
    responseHeader: settlementResponseHeader(config, { txHash, payer }),
  };
}

async function verifyViaLocalRelayer(
  request: Request,
  requirements: PaymentRequirements,
  config: MerchantConfig,
  priceUsdg: string,
): Promise<X402VerifiedPayment | null> {
  const result = await verifyAndSettle(request, config);
  if (result === null) return null;
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return {
    txHash: result.txHash,
    payer: result.payer,
    amountUsdg: priceUsdg,
    requirements,
    responseHeader: settlementResponseHeader(config, result),
  };
}

export async function verifyX402Payment(input: {
  request: Request;
  requirements: PaymentRequirements;
  priceUsdg: string;
}): Promise<X402VerifiedPayment | null> {
  const config = buildMerchantConfig(input.priceUsdg);
  if (meshgatewayFacilitatorUrl()) {
    return verifyViaFacilitator(input.request, input.requirements, config, input.priceUsdg);
  }
  return verifyViaLocalRelayer(input.request, input.requirements, config, input.priceUsdg);
}

export function settlementHeaders(payment: X402VerifiedPayment) {
  return {
    [PAYMENT_RESPONSE_HEADER]: payment.responseHeader,
  };
}
