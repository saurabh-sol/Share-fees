import { gatewayOptions, getModel } from "@/lib/gateway/http";

export const OPTIONS = gatewayOptions;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return getModel(request, decodeURIComponent(id));
}
