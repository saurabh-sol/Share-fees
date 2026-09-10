import { getSession } from "@/lib/auth/session";
import { listEnabledModels } from "@/lib/ai-create/models";
import { jsonError } from "@/lib/security/origin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }

  const url = new URL(request.url);
  const category = url.searchParams.get("category") ?? undefined;
  const models = await listEnabledModels(category);

  return Response.json(
    { models },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
