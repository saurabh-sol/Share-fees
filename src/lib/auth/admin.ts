import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { ADMIN_COOKIE } from "./cookie";

export { ADMIN_COOKIE };

const ADMIN_TTL_SECONDS = 60 * 60 * 8;

export class AdminError extends Error {
  constructor(
    message: string,
    readonly status = 401,
  ) {
    super(message);
    this.name = "AdminError";
  }
}

function secretKey() {
  return new TextEncoder().encode(env.sessionSecret);
}

export async function signAdminToken(expiresAt: Date) {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .setIssuer(env.appOrigin)
    .setAudience(env.appOrigin)
    .sign(secretKey());
}

export async function verifyAdminToken(token: string) {
  const { payload } = await jwtVerify(token, secretKey(), {
    issuer: env.appOrigin,
    audience: env.appOrigin,
  });
  if (payload.role !== "admin") {
    throw new Error("invalid_admin");
  }
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return "";
}

export function adminCookieOptions(maxAge = ADMIN_TTL_SECONDS) {
  return {
    name: ADMIN_COOKIE,
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function assertAdmin(request: Request) {
  if (!env.adminSecret) {
    throw new AdminError("admin_disabled");
  }
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (bearer.length >= 16 && bearer === env.adminSecret) {
    return;
  }
  const token = readCookie(request, ADMIN_COOKIE);
  if (!token) {
    throw new AdminError("admin_unauthorized");
  }
  try {
    await verifyAdminToken(token);
  } catch {
    throw new AdminError("admin_unauthorized");
  }
}

export async function getAdminSession() {
  if (!env.adminSecret) return null;
  const jar = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  try {
    await verifyAdminToken(token);
    return { role: "admin" as const };
  } catch {
    return null;
  }
}

export async function issueAdminCookie() {
  if (!env.adminSecret) {
    throw new AdminError("admin_disabled");
  }
  const expiresAt = new Date(Date.now() + ADMIN_TTL_SECONDS * 1000);
  const token = await signAdminToken(expiresAt);
  return { token, expiresAt, options: adminCookieOptions() };
}
