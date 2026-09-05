import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { authNonces } from "@/lib/db/schema";
import type { ChainNamespace } from "./addresses";

const NONCE_TTL_MS = 10 * 60 * 1000;

export async function issueNonce(namespace: ChainNamespace, address: string) {
  const db = await getDb();
  const nonce = crypto.randomUUID().replaceAll("-", "");
  await db.insert(authNonces).values({
    id: crypto.randomUUID(),
    nonce,
    chainNamespace: namespace,
    address,
    expiresAt: new Date(Date.now() + NONCE_TTL_MS),
  });
  return nonce;
}

export async function consumeNonce(input: {
  nonce: string;
  namespace: ChainNamespace;
  address: string;
}) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(authNonces)
    .where(
      and(
        eq(authNonces.nonce, input.nonce),
        eq(authNonces.chainNamespace, input.namespace),
        eq(authNonces.address, input.address),
        isNull(authNonces.consumedAt),
      ),
    )
    .limit(1);

  if (!row) {
    throw new Error("unknown_nonce");
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new Error("nonce_expired");
  }

  await db
    .update(authNonces)
    .set({ consumedAt: new Date() })
    .where(eq(authNonces.id, row.id));
}
