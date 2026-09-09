import { decodeBase64Json } from "@meshgateway/mpp-server";
import {
  RESPONSE_HEADER_X402_PAYER,
  RESPONSE_HEADER_X402_SETTLED,
  RESPONSE_HEADER_X402_TX,
} from "@/lib/brand";
import { robinhoodTxUrl } from "@/lib/chains/robinhood";

export type X402PaymentReceipt = {
  success: true;
  transaction: string;
  payer: string;
  network: string;
  explorerUrl: string;
};

export function x402ReceiptHeaders(input: {
  txHash: string;
  payer: string;
  paymentResponseHeader: string;
}) {
  return {
    "payment-response": input.paymentResponseHeader,
    [RESPONSE_HEADER_X402_SETTLED]: "true",
    [RESPONSE_HEADER_X402_TX]: input.txHash,
    [RESPONSE_HEADER_X402_PAYER]: input.payer,
  };
}

export function parsePaymentResponseHeader(header: string | null): X402PaymentReceipt | null {
  if (!header) return null;
  try {
    const decoded = decodeBase64Json<{
      success?: boolean;
      transaction?: string;
      payer?: string;
      network?: string;
    }>(header);
    if (decoded.success !== true || !decoded.transaction || !decoded.payer) {
      return null;
    }
    return {
      success: true,
      transaction: decoded.transaction,
      payer: decoded.payer,
      network: decoded.network ?? "eip155:4663",
      explorerUrl: robinhoodTxUrl(decoded.transaction),
    };
  } catch {
    return null;
  }
}

export function readX402Receipt(response: Response): X402PaymentReceipt | null {
  const fromStandard =
    parsePaymentResponseHeader(response.headers.get("payment-response")) ??
    parsePaymentResponseHeader(response.headers.get("x-payment-response"));
  if (fromStandard) return fromStandard;

  const txHash = response.headers.get(RESPONSE_HEADER_X402_TX);
  const payer = response.headers.get(RESPONSE_HEADER_X402_PAYER);
  const settled = response.headers.get(RESPONSE_HEADER_X402_SETTLED);
  if (settled !== "true" || !txHash || !payer) return null;
  return {
    success: true,
    transaction: txHash,
    payer,
    network: "eip155:4663",
    explorerUrl: robinhoodTxUrl(txHash),
  };
}
