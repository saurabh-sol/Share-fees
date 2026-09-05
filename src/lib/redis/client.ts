import { createClient, type RedisClientType } from "redis";
import { env } from "@/lib/env";

type RedisClient = RedisClientType;

const globalForRedis = globalThis as unknown as {
  t2cRedis?: RedisClient;
  t2cRedisReady?: Promise<RedisClient>;
};

function redisOptions() {
  if (env.redisUrl) {
    return { url: env.redisUrl };
  }
  if (env.redisHost && env.redisPassword) {
    return {
      username: env.redisUsername || "default",
      password: env.redisPassword,
      socket: {
        host: env.redisHost,
        port: env.redisPort,
      },
    };
  }
  return null;
}

export function redisConfigured(): boolean {
  return redisOptions() !== null;
}

export async function getRedis(): Promise<RedisClient | null> {
  const options = redisOptions();
  if (!options) return null;

  if (globalForRedis.t2cRedis?.isOpen) {
    return globalForRedis.t2cRedis;
  }

  if (!globalForRedis.t2cRedisReady) {
    globalForRedis.t2cRedisReady = (async () => {
      const client = createClient(options);
      client.on("error", (error) => {
        console.error("Redis client error", error);
      });
      await client.connect();
      globalForRedis.t2cRedis = client;
      return client;
    })().catch((error) => {
      globalForRedis.t2cRedisReady = undefined;
      throw error;
    });
  }

  return globalForRedis.t2cRedisReady;
}

export async function redisPing(): Promise<boolean> {
  const client = await getRedis();
  if (!client) return false;
  const result = await client.ping();
  return result === "PONG";
}
