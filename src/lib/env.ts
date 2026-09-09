import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SESSION_SECRET: z.string().min(32).optional(),
  APP_ORIGIN: z.string().url().optional(),
  ALLOW_MOCK_SWAPS: z.enum(["true", "false"]).optional(),
  ADMIN_SECRET: z.string().min(16).optional(),
  DATABASE_URL: z.string().optional(),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  LIFI_API_KEY: z.string().optional(),
  CHANGENOW_API_KEY: z.string().optional(),
  ZERION_API_KEY: z.string().optional(),
  ALCHEMY_API_KEY: z.string().optional(),
  AI_GATEWAY_API_KEY: z.string().optional(),
  VERCEL_OIDC_TOKEN: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  XAI_API_KEY: z.string().optional(),
  MISTRAL_API_KEY: z.string().optional(),
  COHERE_API_KEY: z.string().optional(),
  PERPLEXITY_API_KEY: z.string().optional(),
  MOONSHOT_API_KEY: z.string().optional(),
  TREASURY_ENABLED: z.enum(["true", "false"]).optional(),
  TREASURY_LIVE: z.enum(["true", "false"]).optional(),
  TREASURY_PRIVATE_KEY: z.string().optional(),
  REWARD_VAULT_ADDRESS: z
    .string()
    .regex(/^$|^0x[0-9a-fA-F]{40}$/)
    .optional(),
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),
  REDIS_USERNAME: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),
  CRON_SECRET: z.string().min(16).optional(),
  LIFI_WEBHOOK_SECRET: z.string().min(8).optional(),
  CHANGENOW_WEBHOOK_SECRET: z.string().min(8).optional(),
  NEXT_PUBLIC_PRIVY_APP_ID: z.string().min(1).optional(),
  PRIVY_APP_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_PRIVY_CLIENT_ID: z.string().min(1).optional(),
  PRIVY_CLIENT_ID: z.string().min(1).optional(),
  PRIVY_APP_SECRET: z.string().min(1).optional(),
});

function cleanEnv(value: string | undefined) {
  return value?.trim().replace(/^['"]|['"]$/g, "") || undefined;
}

const parsed = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  SESSION_SECRET: process.env.SESSION_SECRET,
  APP_ORIGIN: process.env.APP_ORIGIN,
  ALLOW_MOCK_SWAPS: process.env.ALLOW_MOCK_SWAPS,
  ADMIN_SECRET: process.env.ADMIN_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  LIFI_API_KEY: process.env.LIFI_API_KEY,
  CHANGENOW_API_KEY: process.env.CHANGENOW_API_KEY,
  ZERION_API_KEY: process.env.ZERION_API_KEY,
  ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY,
  AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
  VERCEL_OIDC_TOKEN: process.env.VERCEL_OIDC_TOKEN,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  XAI_API_KEY: process.env.XAI_API_KEY,
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
  COHERE_API_KEY: process.env.COHERE_API_KEY,
  PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY,
  MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY,
  TREASURY_ENABLED: process.env.TREASURY_ENABLED,
  TREASURY_LIVE: process.env.TREASURY_LIVE,
  TREASURY_PRIVATE_KEY: process.env.TREASURY_PRIVATE_KEY,
  REWARD_VAULT_ADDRESS: process.env.REWARD_VAULT_ADDRESS,
  REDIS_URL: process.env.REDIS_URL,
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
  REDIS_USERNAME: process.env.REDIS_USERNAME,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  CRON_SECRET: process.env.CRON_SECRET,
  LIFI_WEBHOOK_SECRET: process.env.LIFI_WEBHOOK_SECRET,
  CHANGENOW_WEBHOOK_SECRET: process.env.CHANGENOW_WEBHOOK_SECRET,
  NEXT_PUBLIC_PRIVY_APP_ID: cleanEnv(process.env.NEXT_PUBLIC_PRIVY_APP_ID),
  PRIVY_APP_ID: cleanEnv(process.env.PRIVY_APP_ID),
  NEXT_PUBLIC_PRIVY_CLIENT_ID: cleanEnv(process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID),
  PRIVY_CLIENT_ID: cleanEnv(process.env.PRIVY_CLIENT_ID ?? process.env.client_id),
  PRIVY_APP_SECRET: cleanEnv(process.env.PRIVY_APP_SECRET ?? process.env.privy_secret),
});

const isBuild = process.env.NEXT_PHASE === "phase-production-build";

if (parsed.NODE_ENV === "production" && !isBuild) {
  if (!parsed.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required in production (min 32 chars).");
  }
  if (!parsed.APP_ORIGIN) {
    throw new Error("APP_ORIGIN is required in production.");
  }
  if (!parsed.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in production.");
  }
  if (!parsed.REDIS_URL && !(parsed.REDIS_HOST && parsed.REDIS_PASSWORD)) {
    throw new Error("Redis is required in production (REDIS_URL or REDIS_HOST+REDIS_PASSWORD).");
  }
  if (!parsed.CRON_SECRET) {
    throw new Error("CRON_SECRET is required in production (min 16 chars).");
  }
  if (parsed.ALLOW_MOCK_SWAPS === "true") {
    throw new Error("ALLOW_MOCK_SWAPS cannot be true in production.");
  }
}

export const env = {
  nodeEnv: parsed.NODE_ENV,
  sessionSecret:
    parsed.SESSION_SECRET ??
    "dev-only-session-secret-do-not-use-in-prod-32",
  appOrigin: parsed.APP_ORIGIN ?? "http://localhost:3000",
  allowMockSwaps:
    parsed.ALLOW_MOCK_SWAPS === "true" && parsed.NODE_ENV !== "production",
  adminSecret: parsed.ADMIN_SECRET,
  databaseUrl: parsed.DATABASE_URL,
  walletConnectProjectId: parsed.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  publicAppUrl: parsed.NEXT_PUBLIC_APP_URL ?? parsed.APP_ORIGIN ?? "http://localhost:3000",
  lifiApiKey: parsed.LIFI_API_KEY,
  changeNowApiKey: parsed.CHANGENOW_API_KEY,
  zerionApiKey: parsed.ZERION_API_KEY,
  alchemyApiKey: parsed.ALCHEMY_API_KEY,
  aiGatewayApiKey: parsed.AI_GATEWAY_API_KEY,
  vercelOidcToken: parsed.VERCEL_OIDC_TOKEN,
  openaiApiKey: parsed.OPENAI_API_KEY,
  anthropicApiKey: parsed.ANTHROPIC_API_KEY,
  deepseekApiKey: parsed.DEEPSEEK_API_KEY,
  googleApiKey: parsed.GOOGLE_API_KEY || parsed.GEMINI_API_KEY,
  xaiApiKey: parsed.XAI_API_KEY,
  mistralApiKey: parsed.MISTRAL_API_KEY,
  cohereApiKey: parsed.COHERE_API_KEY,
  perplexityApiKey: parsed.PERPLEXITY_API_KEY,
  moonshotApiKey: parsed.MOONSHOT_API_KEY,
  treasuryEnabled: parsed.TREASURY_ENABLED === "true",
  treasuryDisabled: parsed.TREASURY_ENABLED === "false",
  treasuryLive: parsed.TREASURY_LIVE === "true",
  treasuryPrivateKey: parsed.TREASURY_PRIVATE_KEY,
  rewardVaultAddress: parsed.REWARD_VAULT_ADDRESS || undefined,
  redisUrl: parsed.REDIS_URL,
  redisHost: parsed.REDIS_HOST,
  redisPort: parsed.REDIS_PORT ? Number(parsed.REDIS_PORT) : 6379,
  redisUsername: parsed.REDIS_USERNAME ?? "default",
  redisPassword: parsed.REDIS_PASSWORD,
  cronSecret: parsed.CRON_SECRET,
  lifiWebhookSecret: parsed.LIFI_WEBHOOK_SECRET,
  changeNowWebhookSecret: parsed.CHANGENOW_WEBHOOK_SECRET,
  privyAppId: parsed.NEXT_PUBLIC_PRIVY_APP_ID ?? parsed.PRIVY_APP_ID,
  privyClientId: parsed.NEXT_PUBLIC_PRIVY_CLIENT_ID ?? parsed.PRIVY_CLIENT_ID,
  privyAppSecret: parsed.PRIVY_APP_SECRET,
};

export function appDomain(): string {
  return new URL(env.appOrigin).host;
}
