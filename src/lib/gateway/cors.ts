import {
  RESPONSE_HEADER_PROVIDER,
  RESPONSE_HEADER_REMAINING,
  RESPONSE_HEADER_SPEND_CAP,
  RESPONSE_HEADER_X402_PAYER,
  RESPONSE_HEADER_X402_SETTLED,
  RESPONSE_HEADER_X402_TX,
} from "@/lib/brand";

const X402_HEADERS =
  "payment-required, payment-signature, payment-response, x-payment, X-Payment, X-Payment-Response";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": [
    "Authorization",
    "Content-Type",
    "api-key",
    "x-api-key",
    "x-goog-api-key",
    "anthropic-version",
    "anthropic-beta",
    X402_HEADERS,
  ].join(", "),
  "Access-Control-Expose-Headers": [
    RESPONSE_HEADER_REMAINING,
    RESPONSE_HEADER_PROVIDER,
    RESPONSE_HEADER_SPEND_CAP,
    RESPONSE_HEADER_X402_TX,
    RESPONSE_HEADER_X402_PAYER,
    RESPONSE_HEADER_X402_SETTLED,
    "payment-required",
    "payment-response",
    "x-payment-response",
  ].join(", "),
  "Access-Control-Max-Age": "86400",
};

export function withGatewayCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function gatewayPreflight() {
  return withGatewayCors(new Response(null, { status: 204 }));
}

export function gatewayJson(status: number, body: unknown) {
  return withGatewayCors(Response.json(body, { status }));
}
