import { z } from "zod";
import { PRODUCTION_APP_ORIGIN } from "@/lib/brand";

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
  STOCK_INVENTORY_WALLET: z
    .string()
    .regex(/^$|^0x[0-9a-fA-F]{40}$/)
    .optional(),
  STOCK_TREASURY_PRIVATE_KEY: z.string().optional(),
  NVDA_USD_CENTS: z.string().optional(),
  AAPL_USD_CENTS: z.string().optional(),
  MSFT_USD_CENTS: z.string().optional(),
  STOCK_DEMO_INVENTORY: z.enum(["true", "false"]).optional(),
  STOCK_REDEEM_ENABLED: z.enum(["true", "false"]).optional(),
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
  ACCRUED_V2_UPGRADE: z.enum(["true", "false"]).optional(),
  USDG_REWARDS_PAUSED: z.enum(["true", "false"]).optional(),
  ACCRUED_SWAP_ROUTER_ADDRESS: z
    .string()
    .regex(/^$|^0x[0-9a-fA-F]{40}$/)
    .optional(),
  NEXT_PUBLIC_ACCRUED_SWAP_ROUTER_ADDRESS: z
    .string()
    .regex(/^$|^0x[0-9a-fA-F]{40}$/)
    .optional(),
  ACCR_DEPOSIT_WALLET: z
    .string()
    .regex(/^$|^0x[0-9a-fA-F]{40}$/)
    .optional(),
  DEPOSIT_DISPLAY_MULTIPLIER: z.string().optional(),
  DEPOSIT_GRANT_BPS: z.string().optional(),
  DEPOSIT_MIN_USD_CENTS: z.string().optional(),
  ACCR_PRICE_USD: z.string().optional(),
  REPLICATE_API_TOKEN: z.string().min(8).optional(),
  AI_CREATE_ENABLED: z.enum(["true", "false"]).optional(),
  AI_CREATE_MAX_CONCURRENT: z.string().optional(),
  AI_CREATE_DAILY_CAP_CENTS: z.string().optional(),
  REPLICATE_DAILY_BUDGET_CENTS: z.string().optional(),
  REPLICATE_WEBHOOK_SECRET: z.string().min(8).optional(),
  AI_STORAGE_LOCAL: z.enum(["true", "false"]).optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
});

function cleanEnv(value: string | undefined) {
  return value?.trim().replace(/^['"]|['"]$/g, "") || undefined;
}

/** Accept a bare Alchemy key or a pasted RPC URL (`…/v2/<key>`). */
export function normalizeAlchemyApiKey(raw: string | undefined) {
  const cleaned = cleanEnv(raw)?.split("#")[0]?.trim();
  if (!cleaned) return undefined;
  const fromUrl = cleaned.match(/\/v2\/([^/?#]+)/)?.[1];
  return (fromUrl ?? cleaned).trim() || undefined;
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
  LIFI_API_KEY: cleanEnv(process.env.LIFI_API_KEY),
  CHANGENOW_API_KEY: cleanEnv(process.env.CHANGENOW_API_KEY),
  ZERION_API_KEY: cleanEnv(process.env.ZERION_API_KEY),
  ALCHEMY_API_KEY: normalizeAlchemyApiKey(process.env.ALCHEMY_API_KEY),
  AI_GATEWAY_API_KEY: cleanEnv(process.env.AI_GATEWAY_API_KEY),
  VERCEL_OIDC_TOKEN: cleanEnv(process.env.VERCEL_OIDC_TOKEN),
  OPENAI_API_KEY: cleanEnv(process.env.OPENAI_API_KEY),
  ANTHROPIC_API_KEY: cleanEnv(process.env.ANTHROPIC_API_KEY),
  DEEPSEEK_API_KEY: cleanEnv(process.env.DEEPSEEK_API_KEY),
  GOOGLE_API_KEY: cleanEnv(process.env.GOOGLE_API_KEY),
  GEMINI_API_KEY: cleanEnv(process.env.GEMINI_API_KEY),
  XAI_API_KEY: cleanEnv(process.env.XAI_API_KEY),
  MISTRAL_API_KEY: cleanEnv(process.env.MISTRAL_API_KEY),
  COHERE_API_KEY: cleanEnv(process.env.COHERE_API_KEY),
  PERPLEXITY_API_KEY: cleanEnv(process.env.PERPLEXITY_API_KEY),
  MOONSHOT_API_KEY: cleanEnv(process.env.MOONSHOT_API_KEY),
  TREASURY_ENABLED: process.env.TREASURY_ENABLED,
  TREASURY_LIVE: process.env.TREASURY_LIVE,
  TREASURY_PRIVATE_KEY: process.env.TREASURY_PRIVATE_KEY,
  REWARD_VAULT_ADDRESS: process.env.REWARD_VAULT_ADDRESS,
  STOCK_INVENTORY_WALLET: process.env.STOCK_INVENTORY_WALLET,
  STOCK_TREASURY_PRIVATE_KEY: process.env.STOCK_TREASURY_PRIVATE_KEY,
  NVDA_USD_CENTS: process.env.NVDA_USD_CENTS,
  AAPL_USD_CENTS: process.env.AAPL_USD_CENTS,
  MSFT_USD_CENTS: process.env.MSFT_USD_CENTS,
  STOCK_DEMO_INVENTORY: process.env.STOCK_DEMO_INVENTORY,
  STOCK_REDEEM_ENABLED: process.env.STOCK_REDEEM_ENABLED,
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
  ACCRUED_V2_UPGRADE: process.env.ACCRUED_V2_UPGRADE,
  USDG_REWARDS_PAUSED: process.env.USDG_REWARDS_PAUSED,
  ACCRUED_SWAP_ROUTER_ADDRESS: process.env.ACCRUED_SWAP_ROUTER_ADDRESS,
  NEXT_PUBLIC_ACCRUED_SWAP_ROUTER_ADDRESS: process.env.NEXT_PUBLIC_ACCRUED_SWAP_ROUTER_ADDRESS,
  ACCR_DEPOSIT_WALLET: process.env.ACCR_DEPOSIT_WALLET,
  DEPOSIT_DISPLAY_MULTIPLIER: process.env.DEPOSIT_DISPLAY_MULTIPLIER,
  DEPOSIT_GRANT_BPS: process.env.DEPOSIT_GRANT_BPS,
  DEPOSIT_MIN_USD_CENTS: process.env.DEPOSIT_MIN_USD_CENTS,
  ACCR_PRICE_USD: process.env.ACCR_PRICE_USD,
  REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN,
  AI_CREATE_ENABLED: process.env.AI_CREATE_ENABLED,
  AI_CREATE_MAX_CONCURRENT: process.env.AI_CREATE_MAX_CONCURRENT,
  AI_CREATE_DAILY_CAP_CENTS: process.env.AI_CREATE_DAILY_CAP_CENTS,
  REPLICATE_DAILY_BUDGET_CENTS: process.env.REPLICATE_DAILY_BUDGET_CENTS,
  REPLICATE_WEBHOOK_SECRET: process.env.REPLICATE_WEBHOOK_SECRET,
  AI_STORAGE_LOCAL: process.env.AI_STORAGE_LOCAL,
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  R2_PUBLIC_URL: process.env.R2_PUBLIC_URL,
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
  appOrigin:
    parsed.APP_ORIGIN ??
    (parsed.NODE_ENV === "production" ? PRODUCTION_APP_ORIGIN : "http://localhost:3000"),
  allowMockSwaps:
    parsed.ALLOW_MOCK_SWAPS === "true" && parsed.NODE_ENV !== "production",
  adminSecret: parsed.ADMIN_SECRET,
  databaseUrl: parsed.DATABASE_URL,
  walletConnectProjectId: parsed.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  publicAppUrl:
    parsed.NEXT_PUBLIC_APP_URL ??
    parsed.APP_ORIGIN ??
    (parsed.NODE_ENV === "production" ? PRODUCTION_APP_ORIGIN : "http://localhost:3000"),
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
  stockInventoryWallet: parsed.STOCK_INVENTORY_WALLET || undefined,
  stockTreasuryPrivateKey: parsed.STOCK_TREASURY_PRIVATE_KEY,
  nvdaUsdCents: parsed.NVDA_USD_CENTS ? Number(parsed.NVDA_USD_CENTS) : undefined,
  aaplUsdCents: parsed.AAPL_USD_CENTS ? Number(parsed.AAPL_USD_CENTS) : undefined,
  msftUsdCents: parsed.MSFT_USD_CENTS ? Number(parsed.MSFT_USD_CENTS) : undefined,
  stockDemoInventory: parsed.STOCK_DEMO_INVENTORY !== "false",
  stockRedeemEnabled: parsed.STOCK_REDEEM_ENABLED === "true",
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
  accruedV2Upgrade: parsed.ACCRUED_V2_UPGRADE === "true",
  /** Independent of ACCRUED_V2_UPGRADE — only set true to pause USDG convert/redeem. */
  usdgRewardsPaused: parsed.USDG_REWARDS_PAUSED === "true",
  accruedSwapRouterAddress:
    parsed.ACCRUED_SWAP_ROUTER_ADDRESS ??
    parsed.NEXT_PUBLIC_ACCRUED_SWAP_ROUTER_ADDRESS ??
    "0xc78e883f87675e75334df4d341f6fcb0915ebf19",
  accrDepositWallet: parsed.ACCR_DEPOSIT_WALLET || undefined,
  depositDisplayMultiplier: parsed.DEPOSIT_DISPLAY_MULTIPLIER
    ? Number(parsed.DEPOSIT_DISPLAY_MULTIPLIER)
    : 2,
  depositGrantBps: parsed.DEPOSIT_GRANT_BPS ? Number(parsed.DEPOSIT_GRANT_BPS) : 6000,
  depositMinUsdCents: parsed.DEPOSIT_MIN_USD_CENTS ? Number(parsed.DEPOSIT_MIN_USD_CENTS) : 500,
  accrPriceUsd: parsed.ACCR_PRICE_USD ? Number(parsed.ACCR_PRICE_USD) : undefined,
  replicateApiToken: parsed.REPLICATE_API_TOKEN,
  aiCreateEnabled: parsed.AI_CREATE_ENABLED === "true",
  aiCreateMaxConcurrent: parsed.AI_CREATE_MAX_CONCURRENT
    ? Number(parsed.AI_CREATE_MAX_CONCURRENT)
    : 2,
  aiCreateDailyCapCents: parsed.AI_CREATE_DAILY_CAP_CENTS
    ? Number(parsed.AI_CREATE_DAILY_CAP_CENTS)
    : 2000,
  replicateDailyBudgetCents: parsed.REPLICATE_DAILY_BUDGET_CENTS
    ? Number(parsed.REPLICATE_DAILY_BUDGET_CENTS)
    : 50_000,
  replicateWebhookSecret: parsed.REPLICATE_WEBHOOK_SECRET,
  aiStorageLocal:
    parsed.AI_STORAGE_LOCAL === "true" ||
    (parsed.AI_STORAGE_LOCAL !== "false" && parsed.NODE_ENV === "development"),
  r2AccountId: parsed.R2_ACCOUNT_ID,
  r2AccessKeyId: parsed.R2_ACCESS_KEY_ID,
  r2SecretAccessKey: parsed.R2_SECRET_ACCESS_KEY,
  r2BucketName: parsed.R2_BUCKET_NAME,
  r2PublicUrl: parsed.R2_PUBLIC_URL,
  r2Configured: Boolean(
    parsed.R2_ACCOUNT_ID &&
      parsed.R2_ACCESS_KEY_ID &&
      parsed.R2_SECRET_ACCESS_KEY &&
      parsed.R2_BUCKET_NAME,
  ),
};

export function appDomain(): string {
  return new URL(env.appOrigin).host;
}
