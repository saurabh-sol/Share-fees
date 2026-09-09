import { isVirtualKey } from "@/lib/brand";
import { buildPaymentChallenge } from "@/lib/x402/challenge";
import { isX402Enabled, x402Configured } from "@/lib/x402/config";
import { quotePaymentRequirements, resolveQuoteModel } from "@/lib/x402/quote";
import { x402ReceiptHeaders } from "@/lib/x402/receipt";
import { readPaymentHeader, verifyX402Payment } from "@/lib/x402/verify";
import type { GatewayAuthContext, X402RouteKind } from "@/lib/x402/types";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROVIDER,
  type LlmProvider,
} from "./catalog";
import { GatewayError } from "./errors";
import { readOptionalGatewayApiKey } from "./openai";
import { authenticateVirtualKey } from "./service";

type Db = Awaited<ReturnType<typeof import("@/lib/db/client").getDb>>;

export class PaymentRequiredError extends Error {
  readonly status = 402;
  readonly challenge: Response;

  constructor(challenge: Response) {
    super("payment_required");
    this.name = "PaymentRequiredError";
    this.challenge = challenge;
  }
}

function providerForRoute(route: X402RouteKind): LlmProvider {
  if (route === "messages") return "anthropic";
  if (route === "generate") return "google";
  return DEFAULT_LLM_PROVIDER;
}

function modelFromBody(body: unknown, route: X402RouteKind, modelOverride?: string) {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const provider = providerForRoute(route);
  const modelField = route === "generate" ? modelOverride : record.model;
  return resolveQuoteModel(provider, modelField);
}

export async function resolveGatewayAuth(input: {
  request: Request;
  body?: unknown;
  route: X402RouteKind;
  modelOverride?: string;
  db?: Db;
}): Promise<GatewayAuthContext> {
  const token = readOptionalGatewayApiKey(input.request);
  if (token && isVirtualKey(token)) {
    const key = await authenticateVirtualKey(token, input.db);
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

  if (!isX402Enabled()) {
    throw new GatewayError("invalid_api_key", 401);
  }

  if (!x402Configured()) {
    throw new GatewayError("x402_not_configured", 503);
  }

  const { provider, model } = modelFromBody(input.body, input.route, input.modelOverride);
  const resourceUrl = input.request.url;
  const { priceUsdg, requirements } = quotePaymentRequirements({
    provider,
    model,
    resourceUrl,
    description: `${provider}/${model}`,
  });

  let payment: Awaited<ReturnType<typeof verifyX402Payment>>;
  try {
    payment = await verifyX402Payment({
      request: input.request,
      requirements,
      priceUsdg,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "payment_verification_failed";
    throw new PaymentRequiredError(
      buildPaymentChallenge({
        resourceUrl,
        provider,
        model,
        error: `Payment could not be verified: ${reason}`,
      }),
    );
  }

  if (payment) {
    return {
      mode: "x402",
      payer: payment.payer,
      txHash: payment.txHash,
      maxPriceUsdg: priceUsdg,
      provider,
      model,
      responseHeaders: x402ReceiptHeaders({
        txHash: payment.txHash,
        payer: payment.payer,
        paymentResponseHeader: payment.responseHeader,
      }),
    };
  }

  const hint = readPaymentHeader(input.request)
    ? "Payment header present but incomplete."
    : "Payment is required for this LLM request.";
  throw new PaymentRequiredError(
    buildPaymentChallenge({
      resourceUrl,
      provider,
      model,
      error: hint,
    }),
  );
}

export async function resolveModelsAuth(input: {
  request: Request;
  db?: Db;
}): Promise<GatewayAuthContext | null> {
  const token = readOptionalGatewayApiKey(input.request);
  if (token && isVirtualKey(token)) {
    const key = await authenticateVirtualKey(token, input.db);
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
  if (isX402Enabled()) return null;
  throw new GatewayError("invalid_api_key", 401);
}
