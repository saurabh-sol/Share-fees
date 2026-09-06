import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { and, eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { getDb } from "@/lib/db/client";
import { sessions, users, wallets, type User } from "@/lib/db/schema";
import type { ChainNamespace } from "./addresses";
import { SESSION_COOKIE, readCookie } from "./cookie";

export { SESSION_COOKIE };
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionClaims = {
  sid: string;
  sub: string;
  addr: string;
  ns: ChainNamespace;
  exp?: number;
};

function secretKey() {
  return new TextEncoder().encode(env.sessionSecret);
}

export async function signSessionToken(claims: SessionClaims, expiresAt: Date) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .setIssuer(env.appOrigin)
    .setAudience(env.appOrigin)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionClaims> {
  const { payload } = await jwtVerify(token, secretKey(), {
    issuer: env.appOrigin,
    audience: env.appOrigin,
  });
  if (
    typeof payload.sid !== "string" ||
    typeof payload.sub !== "string" ||
    typeof payload.addr !== "string" ||
    (payload.ns !== "eip155" && payload.ns !== "solana")
  ) {
    throw new Error("invalid_session");
  }
  return {
    sid: payload.sid,
    sub: payload.sub,
    addr: payload.addr,
    ns: payload.ns,
    exp: typeof payload.exp === "number" ? payload.exp : undefined,
  };
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    expires: new Date(Date.now() + Math.max(0, maxAge) * 1000),
  };
}

export async function createUserSession(user: User) {
  const db = await getDb();
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    expiresAt,
  });

  const token = await signSessionToken(
    {
      sid: sessionId,
      sub: user.id,
      addr: user.address,
      ns: user.chainNamespace as ChainNamespace,
    },
    expiresAt,
  );

  return { token, expiresAt, sessionId };
}

export async function getSessionFromToken(token: string | undefined) {
  if (!token) return null;
  let claims: SessionClaims;
  try {
    claims = await verifySessionToken(token);
  } catch {
    return null;
  }

  try {
    const db = await getDb();
    let [row] = await db.select().from(sessions).where(eq(sessions.id, claims.sid)).limit(1);

    if (row?.revokedAt) return null;

    if (!row) {
      const expiresAt = claims.exp
        ? new Date(claims.exp * 1000)
        : new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) return null;
      await db
        .insert(sessions)
        .values({ id: claims.sid, userId: claims.sub, expiresAt })
        .onConflictDoNothing();
      [row] = await db.select().from(sessions).where(eq(sessions.id, claims.sid)).limit(1);
    }

    if (!row || row.userId !== claims.sub) return null;
    if (row.revokedAt) return null;
    const expiresAt = row.expiresAt instanceof Date ? row.expiresAt : new Date(String(row.expiresAt));
    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) return null;

    const [user] = await db.select().from(users).where(eq(users.id, claims.sub)).limit(1);
    if (!user) return null;
    return { claims, user };
  } catch (error) {
    console.error("[session]", error instanceof Error ? error.stack ?? error.message : error);
    return null;
  }
}

function tokenFromRequest(request?: Request) {
  if (!request) return undefined;
  const fromHeader = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (fromHeader) return fromHeader;
  const store = (
    request as { cookies?: { get?: (name: string) => { value?: string } | undefined } }
  ).cookies;
  return store?.get?.(SESSION_COOKIE)?.value;
}

export async function getSession(request?: Request) {
  const fromRequest = tokenFromRequest(request);
  if (fromRequest) {
    return getSessionFromToken(fromRequest);
  }
  try {
    const jar = await cookies();
    return getSessionFromToken(jar.get(SESSION_COOKIE)?.value);
  } catch {
    return null;
  }
}

export async function refreshUserSession(session: { claims: SessionClaims; user: User }) {
  const db = await getDb();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, session.claims.sid));
  const token = await signSessionToken(
    {
      sid: session.claims.sid,
      sub: session.claims.sub,
      addr: session.claims.addr,
      ns: session.claims.ns,
    },
    expiresAt,
  );
  return { token, expiresAt };
}

export async function revokeSession(sessionId: string) {
  const db = await getDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, sessionId));
}

export async function upsertWalletUser(
  namespace: ChainNamespace,
  address: string,
) {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(users)
    .where(and(eq(users.chainNamespace, namespace), eq(users.address, address)))
    .limit(1);
  if (existing) return existing;

  const id = crypto.randomUUID();
  const created = {
    id,
    chainNamespace: namespace,
    address,
    rewardPreference: null,
    createdAt: new Date(),
  };
  await db.insert(users).values(created);
  await db.insert(wallets).values({
    userId: id,
    creditCacheCents: 0,
    usdtCacheCents: 0,
    llmCacheCents: 0,
    updatedAt: new Date(),
  });
  return created;
}
