import { gatewayJson, gatewayPreflight } from "@/lib/gateway/cors";
import { x402OpenApiExtension } from "@/lib/x402/discovery";

export const OPTIONS = gatewayPreflight;

export async function GET() {
  return gatewayJson(200, x402OpenApiExtension());
}
