import { dispatchV1Beta, gatewayOptions } from "@/lib/gateway/http";

export const OPTIONS = gatewayOptions;

export async function GET(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path } = await context.params;
  return dispatchV1Beta(request, "GET", path ?? []);
}

export async function POST(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path } = await context.params;
  return dispatchV1Beta(request, "POST", path ?? []);
}
