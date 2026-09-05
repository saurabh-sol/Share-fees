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
  (table) => [index("ledger_user").on(table.userId)],
);

export const wallets = pgTable("wallets", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id),
  usdtCacheCents: integer("usdt_cache_cents").notNull().default(0),
  llmCacheCents: integer("llm_cache_cents").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("redemptions_user_idem").on(table.userId, table.idempotencyKey),
    index("redemptions_user").on(table.userId),
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
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("virtual_keys_hash").on(table.keyHash),
    index("virtual_keys_user").on(table.userId),
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("payout_outbox_redemption").on(table.redemptionId),
    index("payout_outbox_status").on(table.status),
  ],
);

export type User = typeof users.$inferSelect;
export type RewardRule = typeof rewardRules.$inferSelect;
export type Swap = typeof swaps.$inferSelect;
export type DiscoveredSwap = typeof discoveredSwaps.$inferSelect;
