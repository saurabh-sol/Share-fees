import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { and, eq, isNull } from "drizzle-orm";
import { env } from "@/lib/env";
import { getDb } from "@/lib/db/client";
import { sessions, users, wallets, type User } from "@/lib/db/schema";
import type { ChainNamespace } from "./addresses";
import { SESSION_COOKIE } from "./cookie";

export { SESSION_COOKIE };
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionClaims = {
  sid: string;
  sub: string;
  addr: string;
  ns: ChainNamespace;
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
  try {
    const claims = await verifySessionToken(token);
    const db = await getDb();
    const [row] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, claims.sid), isNull(sessions.revokedAt)))
      .limit(1);
    if (!row || row.expiresAt.getTime() <= Date.now() || row.userId !== claims.sub) {
      return null;
    }
    const [user] = await db.select().from(users).where(eq(users.id, claims.sub)).limit(1);
    if (!user) return null;
    return { claims, user };
  } catch {
    return null;
  }
}

export async function getSession() {
  const jar = await cookies();
  return getSessionFromToken(jar.get(SESSION_COOKIE)?.value);
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
    usdtCacheCents: 0,
    llmCacheCents: 0,
    updatedAt: new Date(),
  });
  return created;
}
