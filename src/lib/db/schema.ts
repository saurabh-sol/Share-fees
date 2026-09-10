import {
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    chainNamespace: text("chain_namespace").notNull(),
    address: text("address").notNull(),
    rewardPreference: text("reward_preference"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_namespace_address").on(table.chainNamespace, table.address),
  ],
);

export const authNonces = pgTable(
  "auth_nonces",
  {
    id: text("id").primaryKey(),
    nonce: text("nonce").notNull(),
    chainNamespace: text("chain_namespace").notNull(),
    address: text("address").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("auth_nonces_nonce").on(table.nonce),
    index("auth_nonces_address").on(table.address),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [index("sessions_user").on(table.userId)],
);

export const rewardRules = pgTable("reward_rules", {
  id: text("id").primaryKey(),
  version: integer("version").notNull(),
  conversionBps: integer("conversion_bps").notNull(),
  minNotionalUsdCents: integer("min_notional_usd_cents").notNull(),
  dailyCapUsdCents: integer("daily_cap_usd_cents").notNull(),
  enabled: integer("enabled").notNull().default(1),
  activeFrom: timestamp("active_from", { withTimezone: true }).notNull(),
  activeTo: timestamp("active_to", { withTimezone: true }),
});

export const swaps = pgTable(
  "swaps",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    source: text("source").notNull(),
    txHash: text("tx_hash").notNull(),
    fromChain: text("from_chain").notNull(),
    toChain: text("to_chain").notNull(),
    fromToken: text("from_token").notNull(),
    toToken: text("to_token").notNull(),
    fromAmount: text("from_amount").notNull(),
    toAmount: text("to_amount").notNull(),
    notionalUsdCents: integer("notional_usd_cents").notNull(),
    status: text("status").notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("swaps_tx_chain").on(table.txHash, table.fromChain),
    index("swaps_user").on(table.userId),
  ],
);

export const creditEvents = pgTable(
  "credit_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    swapId: text("swap_id")
      .notNull()
      .references(() => swaps.id),
    ruleId: text("rule_id")
      .notNull()
      .references(() => rewardRules.id),
    rail: text("rail").notNull(),
    amountCents: integer("amount_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("credit_events_swap").on(table.swapId),
    index("credit_events_user").on(table.userId),
  ],
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    account: text("account").notNull(),
    type: text("type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    referenceType: text("reference_type").notNull(),
    referenceId: text("reference_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ledger_user").on(table.userId),
    index("ledger_user_account").on(table.userId, table.account),
    index("ledger_user_account_ref").on(table.userId, table.account, table.referenceId),
  ],
);

export const wallets = pgTable("wallets", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  creditCacheCents: integer("credit_cache_cents").notNull().default(0),
  usdtCacheCents: integer("usdt_cache_cents").notNull().default(0),
  llmCacheCents: integer("llm_cache_cents").notNull().default(0),
  aiCreateCacheCents: integer("ai_create_cache_cents").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const creditConversions = pgTable(
  "credit_conversions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    rail: text("rail").notNull(),
    amountCents: integer("amount_cents").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("credit_conversions_user_idem").on(table.userId, table.idempotencyKey),
    index("credit_conversions_user").on(table.userId),
  ],
);

export const pendingSettles = pgTable(
  "pending_settles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    provider: text("provider").notNull(),
    txHash: text("tx_hash").notNull(),
    exchangeId: text("exchange_id"),
    fromChain: text("from_chain").notNull(),
    toChain: text("to_chain").notNull(),
    status: text("status").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("pending_settles_provider_tx").on(table.provider, table.txHash),
    index("pending_settles_status").on(table.status),
    index("pending_settles_user").on(table.userId),
  ],
);

export const discoveredSwaps = pgTable(
  "discovered_swaps",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    provider: text("provider").notNull(),
    txHash: text("tx_hash").notNull(),
    fromChain: text("from_chain").notNull(),
    toChain: text("to_chain").notNull(),
    fromToken: text("from_token").notNull(),
    toToken: text("to_token").notNull(),
    fromAmount: text("from_amount").notNull(),
    toAmount: text("to_amount").notNull(),
    notionalUsdCents: integer("notional_usd_cents").notNull(),
    kind: text("kind").notNull().default("trade"),
    executedAt: timestamp("executed_at", { withTimezone: true }).notNull(),
    status: text("status").notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("discovered_tx_chain").on(table.txHash, table.fromChain),
    index("discovered_user_status").on(table.userId, table.status),
  ],
);

export const walletScans = pgTable("wallet_scans", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull(),
  provider: text("provider").notNull(),
  foundCount: integer("found_count").notNull().default(0),
});

export const fraudFlags = pgTable("fraud_flags", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  swapId: text("swap_id"),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"),
  rail: text("rail"),
  detail: text("detail"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const redemptions = pgTable(
  "redemptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    rail: text("rail").notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").notNull(),
    destination: text("destination").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    clientIp: text("client_ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("redemptions_user_idem").on(table.userId, table.idempotencyKey),
    index("redemptions_user").on(table.userId),
    index("redemptions_usdt_user_created").on(table.userId, table.rail, table.createdAt),
    index("redemptions_usdt_ip_created").on(table.clientIp, table.rail, table.createdAt),
  ],
);

export const virtualKeys = pgTable(
  "virtual_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    redemptionId: text("redemption_id")
      .notNull()
      .references(() => redemptions.id),
    keyHash: text("key_hash").notNull(),
    prefix: text("prefix").notNull(),
    spendCapCents: integer("spend_cap_cents").notNull(),
    spendUsedCents: integer("spend_used_cents").notNull().default(0),
    provider: text("provider").notNull().default("openai"),
    model: text("model").notNull().default("gpt-4o-mini"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("virtual_keys_hash").on(table.keyHash),
    index("virtual_keys_user").on(table.userId),
  ],
);

export const changenowExchanges = pgTable(
  "changenow_exchanges",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    exchangeId: text("exchange_id").notNull(),
    fromChain: text("from_chain").notNull(),
    toChain: text("to_chain").notNull(),
    fromCurrency: text("from_currency").notNull(),
    toCurrency: text("to_currency").notNull(),
    fromNetwork: text("from_network").notNull(),
    toNetwork: text("to_network").notNull(),
    fromAmount: text("from_amount").notNull(),
    toAmount: text("to_amount").notNull(),
    payinAddress: text("payin_address").notNull(),
    payoutAddress: text("payout_address").notNull(),
    status: text("status").notNull(),
    depositTx: text("deposit_tx"),
    payoutTx: text("payout_tx"),
    notionalUsdCents: integer("notional_usd_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("changenow_exchanges_exchange").on(table.exchangeId),
    index("changenow_exchanges_user").on(table.userId),
    index("changenow_exchanges_status").on(table.status),
  ],
);

export const holderVerifications = pgTable(
  "holder_verifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    walletAddress: text("wallet_address").notNull(),
    tokenAddress: text("token_address").notNull(),
    requiredBalanceRaw: text("required_balance_raw").notNull(),
    startBalanceRaw: text("start_balance_raw").notNull(),
    lastBalanceRaw: text("last_balance_raw").notNull(),
    status: text("status").notNull(),
    rewardCents: integer("reward_cents").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    eligibleAt: timestamp("eligible_at", { withTimezone: true }).notNull(),
    creditedAt: timestamp("credited_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    swapId: text("swap_id"),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("holder_verifications_user_status").on(table.userId, table.status),
    index("holder_verifications_eligible").on(table.status, table.eligibleAt),
  ],
);

export const holderBalanceChecks = pgTable(
  "holder_balance_checks",
  {
    id: text("id").primaryKey(),
    verificationId: text("verification_id")
      .notNull()
      .references(() => holderVerifications.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    balanceRaw: text("balance_raw").notNull(),
    meetsRequirement: integer("meets_requirement").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("holder_balance_checks_verification").on(table.verificationId, table.checkedAt),
    index("holder_balance_checks_user").on(table.userId),
  ],
);

export const x402Settlements = pgTable(
  "x402_settlements",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    payer: text("payer").notNull(),
    txHash: text("tx_hash").notNull(),
    amountUsdg: text("amount_usdg").notNull(),
    model: text("model").notNull(),
    provider: text("provider").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    actualCents: integer("actual_cents").notNull().default(0),
    status: text("status").notNull().default("settled"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("x402_settlements_tx_hash").on(table.txHash),
    index("x402_settlements_payer").on(table.payer),
    index("x402_settlements_created").on(table.createdAt),
  ],
);

export const payoutOutbox = pgTable(
  "payout_outbox",
  {
    id: text("id").primaryKey(),
    redemptionId: text("redemption_id")
      .notNull()
      .references(() => redemptions.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    destination: text("destination").notNull(),
    amountCents: integer("amount_cents").notNull(),
    chain: text("chain").notNull(),
    status: text("status").notNull(),
    txHash: text("tx_hash"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    availableAt: timestamp("available_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("payout_outbox_redemption").on(table.redemptionId),
    index("payout_outbox_status").on(table.status),
  ],
);

export const depositIntents = pgTable(
  "deposit_intents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    usdCents: integer("usd_cents").notNull(),
    tokenAmountRaw: text("token_amount_raw").notNull(),
    tokenAmountHuman: text("token_amount_human").notNull(),
    priceUsd: text("price_usd").notNull(),
    displayCreditCents: integer("display_credit_cents").notNull(),
    grantedLlmCents: integer("granted_llm_cents").notNull(),
    dexPairAddress: text("dex_pair_address"),
    logoUri: text("logo_uri"),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("deposit_intents_user").on(table.userId),
    index("deposit_intents_status").on(table.status),
  ],
);

export const accrDeposits = pgTable(
  "accr_deposits",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    intentId: text("intent_id")
      .notNull()
      .references(() => depositIntents.id),
    txHash: text("tx_hash").unique(),
    tokenAmountRaw: text("token_amount_raw").notNull(),
    usdCentsAtDeposit: integer("usd_cents_at_deposit").notNull(),
    displayCreditCents: integer("display_credit_cents").notNull(),
    grantedLlmCents: integer("granted_llm_cents").notNull(),
    priceUsd: text("price_usd").notNull(),
    dexPairAddress: text("dex_pair_address"),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("accr_deposits_intent").on(table.intentId),
    index("accr_deposits_user").on(table.userId),
    index("accr_deposits_status").on(table.status),
  ],
);

export const aiModels = pgTable(
  "ai_models",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull().default("replicate"),
    category: text("category").notNull(),
    modelSlug: text("model_slug").notNull(),
    displayName: text("display_name").notNull(),
    enabled: integer("enabled").notNull().default(1),
    pricingType: text("pricing_type").notNull().default("fixed_max"),
    maxCostCents: integer("max_cost_cents").notNull(),
    inputSchema: text("input_schema").notNull(),
    asyncRequired: integer("async_required").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_models_category").on(table.category, table.enabled)],
);

export const aiGenerations = pgTable(
  "ai_generations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    modelId: text("model_id")
      .notNull()
      .references(() => aiModels.id),
    provider: text("provider").notNull(),
    providerPredictionId: text("provider_prediction_id"),
    status: text("status").notNull(),
    estimatedCostCents: integer("estimated_cost_cents").notNull(),
    reservedCreditCents: integer("reserved_credit_cents").notNull(),
    finalCostCents: integer("final_cost_cents"),
    holdId: text("hold_id").notNull(),
    input: text("input").notNull(),
    output: text("output"),
    error: text("error"),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("ai_generations_idempotency").on(table.userId, table.idempotencyKey),
    index("ai_generations_user").on(table.userId, table.createdAt),
    index("ai_generations_status").on(table.status),
    uniqueIndex("ai_generations_prediction").on(table.providerPredictionId),
  ],
);

/** Display floors for landing hero stats — live counts grow above these values. */
export const publicDeskStatsBaseline = pgTable("public_desk_stats_baseline", {
  id: text("id").primaryKey(),
  minActiveWallets: integer("min_active_wallets").notNull().default(0),
  minClaimedLlmCents: integer("min_claimed_llm_cents").notNull().default(0),
  minSwapVolumeUsd: integer("min_swap_volume_usd").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type RewardRule = typeof rewardRules.$inferSelect;
export type Swap = typeof swaps.$inferSelect;
export type DiscoveredSwap = typeof discoveredSwaps.$inferSelect;
export type HolderVerification = typeof holderVerifications.$inferSelect;
export type HolderBalanceCheck = typeof holderBalanceChecks.$inferSelect;
