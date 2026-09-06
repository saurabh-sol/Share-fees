import { getRedis, redisConfigured } from "@/lib/redis/client";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function memoryRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (existing.count >= limit) {
    return false;
  }

  existing.count += 1;
  return true;
}

async function redisRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return memoryRateLimit(key, limit, windowMs);

  const redisKey = `rl:${key}`;
  const count = await redis.incr(redisKey);
  const ttl = await redis.pTTL(redisKey);
  if (count === 1 || ttl < 0) {
    await redis.pExpire(redisKey, windowMs);
  }
  return count <= limit;
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  if (!redisConfigured()) {
    return memoryRateLimit(key, limit, windowMs);
  }
  try {
    return await redisRateLimit(key, limit, windowMs);
  } catch {
    return memoryRateLimit(key, limit, windowMs);
  }
}

export async function rateLimitOrThrow(key: string, limit: number, windowMs: number) {
  if (!(await rateLimit(key, limit, windowMs))) {
    throw new RateLimitError();
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryRedisSlot(key: string, limit: number, windowMs: number): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return memoryRateLimit(key, limit, windowMs);

  const redisKey = `slot:${key}`;
  const count = await redis.incr(redisKey);
  const ttl = await redis.pTTL(redisKey);
  if (count === 1 || ttl < 0) {
    await redis.pExpire(redisKey, windowMs);
  }
  if (count <= limit) return true;
  await redis.decr(redisKey);
  return false;
}

/** Shared leaky bucket. Waits instead of failing so 10–50 scans do not stampede Zerion. */
export async function acquireSharedSlot(
  key: string,
  limit: number,
  windowMs: number,
  maxWaitMs = 180_000,
) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const ok = redisConfigured()
      ? await tryRedisSlot(key, limit, windowMs).catch(() => memoryRateLimit(key, limit, windowMs))
      : memoryRateLimit(key, limit, windowMs);
    if (ok) return;
    await sleep(Math.min(500, Math.max(150, Math.floor(windowMs / 4))));
  }
  throw new RateLimitError();
}

export class RateLimitError extends Error {
  constructor() {
    super("rate_limited");
    this.name = "RateLimitError";
  }
}
