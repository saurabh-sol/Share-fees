import { cookies } from "next/headers";
import { getSession, refreshUserSession, sessionCookieOptions } from "@/lib/auth/session";
import { jsonError } from "@/lib/security/origin";

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }

  const refreshed = await refreshUserSession(session);
  const jar = await cookies();
  const cookie = sessionCookieOptions();
  jar.set(cookie.name, refreshed.token, cookie);

  return Response.json(
    {
      user: {
        id: session.user.id,
        address: session.user.address,
        chainNamespace: session.user.chainNamespace,
      },
      expiresAt: refreshed.expiresAt.toISOString(),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
