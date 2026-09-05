import { cookies } from "next/headers";
import { z } from "zod";
import { AdminError, adminCookieOptions, assertAdmin, issueAdminCookie } from "@/lib/auth/admin";
import { env } from "@/lib/env";
import { OriginError, assertSameOrigin, jsonError } from "@/lib/security/origin";
import { adminSessionSchema } from "@/lib/validation/swap";

export async function GET(request: Request) {
  try {
    await assertAdmin(request);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminError) {
      return jsonError(error.status, error.message, "Admin session is missing.");
    }
    return jsonError(401, "admin_unauthorized", "Admin session is missing.");
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!env.adminSecret) {
      return jsonError(401, "admin_disabled", "Admin is not configured.");
    }
    const body = adminSessionSchema.parse(await request.json());
    if (body.secret !== env.adminSecret) {
      return jsonError(401, "admin_unauthorized", "Admin secret was rejected.");
    }
    const issued = await issueAdminCookie();
    const jar = await cookies();
    jar.set(issued.options.name, issued.token, issued.options);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    if (error instanceof z.ZodError) {
      return jsonError(400, "invalid_body", "Admin payload failed validation.");
    }
    return jsonError(401, "admin_unauthorized", "Admin login failed.");
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const jar = await cookies();
    const options = adminCookieOptions(0);
    jar.set(options.name, "", options);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof OriginError) {
      return jsonError(403, "forbidden_origin", "Request origin was rejected.");
    }
    return jsonError(400, "logout_failed", "Admin logout failed.");
  }
}
