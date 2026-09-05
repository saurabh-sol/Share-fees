import { cookies } from "next/headers";
import { getSessionFromToken, revokeSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import { OriginError, assertSameOrigin, jsonError } from "@/lib/security/origin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    const session = await getSessionFromToken(token);
    if (session) {
      await revokeSession(session.claims.sid);
    }
    jar.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    return jsonError(400, "logout_failed", "Could not clear session.");
  }
}
