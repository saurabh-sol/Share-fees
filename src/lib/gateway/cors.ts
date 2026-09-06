const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, api-key, x-api-key, anthropic-version, anthropic-beta",
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
