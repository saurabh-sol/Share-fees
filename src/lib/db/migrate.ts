import { sql, type ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { NeonQueryResultHKT } from "drizzle-orm/neon-serverless";
import type { PgliteQueryResultHKT } from "drizzle-orm/pglite";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type * as schema from "./schema";

type AnyDb = {
  execute: (query: ReturnType<typeof sql>) => Promise<unknown>;
};

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    chain_namespace TEXT NOT NULL,
    address TEXT NOT NULL,
    reward_preference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_namespace_address ON users (chain_namespace, address)`,
  `CREATE TABLE IF NOT EXISTS auth_nonces (
    id TEXT PRIMARY KEY,
    nonce TEXT NOT NULL,
    chain_namespace TEXT NOT NULL,
    address TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS auth_nonces_nonce ON auth_nonces (nonce)`,
  `CREATE INDEX IF NOT EXISTS auth_nonces_address ON auth_nonces (address)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id)`,
  `CREATE TABLE IF NOT EXISTS reward_rules (
    id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    conversion_bps INTEGER NOT NULL,
    min_notional_usd_cents INTEGER NOT NULL,
    daily_cap_usd_cents INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    active_from TIMESTAMPTZ NOT NULL,
    active_to TIMESTAMPTZ
  )`,
  `CREATE TABLE IF NOT EXISTS swaps (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    source TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    from_chain TEXT NOT NULL,
    to_chain TEXT NOT NULL,
    from_token TEXT NOT NULL,
    to_token TEXT NOT NULL,
    from_amount TEXT NOT NULL,
    to_amount TEXT NOT NULL,
    notional_usd_cents INTEGER NOT NULL,
    status TEXT NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS swaps_tx_chain ON swaps (tx_hash, from_chain)`,
  `CREATE INDEX IF NOT EXISTS swaps_user ON swaps (user_id)`,
  `CREATE TABLE IF NOT EXISTS credit_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    swap_id TEXT NOT NULL REFERENCES swaps(id),
    rule_id TEXT NOT NULL REFERENCES reward_rules(id),
    rail TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS credit_events_swap ON credit_events (swap_id)`,
  `CREATE INDEX IF NOT EXISTS credit_events_user ON credit_events (user_id)`,
  `CREATE TABLE IF NOT EXISTS ledger_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    account TEXT NOT NULL,
    type TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    reference_type TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS ledger_user ON ledger_entries (user_id)`,
  `CREATE TABLE IF NOT EXISTS wallets (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    credit_cache_cents INTEGER NOT NULL DEFAULT 0,
    usdt_cache_cents INTEGER NOT NULL DEFAULT 0,
    llm_cache_cents INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE wallets ADD COLUMN IF NOT EXISTS credit_cache_cents INTEGER NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS fraud_flags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    swap_id TEXT,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    rail TEXT,
    detail TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE fraud_flags ADD COLUMN IF NOT EXISTS rail TEXT`,
  `ALTER TABLE fraud_flags ADD COLUMN IF NOT EXISTS detail TEXT`,
  `CREATE TABLE IF NOT EXISTS discovered_swaps (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    provider TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    from_chain TEXT NOT NULL,
    to_chain TEXT NOT NULL,
    from_token TEXT NOT NULL,
    to_token TEXT NOT NULL,
    from_amount TEXT NOT NULL,
    to_amount TEXT NOT NULL,
    notional_usd_cents INTEGER NOT NULL,
    kind TEXT NOT NULL DEFAULT 'trade',
    executed_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL,
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE discovered_swaps ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'trade'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS discovered_tx_chain ON discovered_swaps (tx_hash, from_chain)`,
  `CREATE INDEX IF NOT EXISTS discovered_user_status ON discovered_swaps (user_id, status)`,
  `CREATE TABLE IF NOT EXISTS wallet_scans (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    scanned_at TIMESTAMPTZ NOT NULL,
    provider TEXT NOT NULL,
    found_count INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS redemptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    rail TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL,
    destination TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fulfilled_at TIMESTAMPTZ
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS redemptions_user_idem ON redemptions (user_id, idempotency_key)`,
  `CREATE INDEX IF NOT EXISTS redemptions_user ON redemptions (user_id)`,
  `ALTER TABLE redemptions ADD COLUMN IF NOT EXISTS client_ip TEXT`,
  `CREATE INDEX IF NOT EXISTS redemptions_usdt_user_created ON redemptions (user_id, rail, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS redemptions_usdt_ip_created ON redemptions (client_ip, rail, created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS virtual_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    redemption_id TEXT NOT NULL REFERENCES redemptions(id),
    key_hash TEXT NOT NULL,
    prefix TEXT NOT NULL,
    spend_cap_cents INTEGER NOT NULL,
    spend_used_cents INTEGER NOT NULL DEFAULT 0,
    provider TEXT NOT NULL DEFAULT 'openai',
    model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS virtual_keys_hash ON virtual_keys (key_hash)`,
  `CREATE INDEX IF NOT EXISTS virtual_keys_user ON virtual_keys (user_id)`,
  `CREATE TABLE IF NOT EXISTS payout_outbox (
    id TEXT PRIMARY KEY,
    redemption_id TEXT NOT NULL REFERENCES redemptions(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    destination TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    chain TEXT NOT NULL,
    status TEXT NOT NULL,
    tx_hash TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE payout_outbox ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  `CREATE UNIQUE INDEX IF NOT EXISTS payout_outbox_redemption ON payout_outbox (redemption_id)`,
  `CREATE INDEX IF NOT EXISTS payout_outbox_status ON payout_outbox (status)`,
  `CREATE TABLE IF NOT EXISTS credit_conversions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    rail TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    idempotency_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS credit_conversions_user_idem ON credit_conversions (user_id, idempotency_key)`,
  `CREATE INDEX IF NOT EXISTS credit_conversions_user ON credit_conversions (user_id)`,
  `CREATE TABLE IF NOT EXISTS pending_settles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    provider TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    exchange_id TEXT,
    from_chain TEXT NOT NULL,
    to_chain TEXT NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pending_settles_provider_tx ON pending_settles (provider, tx_hash)`,
  `CREATE INDEX IF NOT EXISTS pending_settles_status ON pending_settles (status)`,
  `CREATE INDEX IF NOT EXISTS pending_settles_user ON pending_settles (user_id)`,
  `CREATE TABLE IF NOT EXISTS changenow_exchanges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    exchange_id TEXT NOT NULL,
    from_chain TEXT NOT NULL,
    to_chain TEXT NOT NULL,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    from_network TEXT NOT NULL,
    to_network TEXT NOT NULL,
    from_amount TEXT NOT NULL,
    to_amount TEXT NOT NULL,
    payin_address TEXT NOT NULL,
    payout_address TEXT NOT NULL,
    status TEXT NOT NULL,
    deposit_tx TEXT,
    payout_tx TEXT,
    notional_usd_cents INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS changenow_exchanges_exchange ON changenow_exchanges (exchange_id)`,
  `CREATE INDEX IF NOT EXISTS changenow_exchanges_user ON changenow_exchanges (user_id)`,
  `CREATE INDEX IF NOT EXISTS changenow_exchanges_status ON changenow_exchanges (status)`,
  `CREATE TABLE IF NOT EXISTS holder_verifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    wallet_address TEXT NOT NULL,
    token_address TEXT NOT NULL,
    required_balance_raw TEXT NOT NULL,
    start_balance_raw TEXT NOT NULL,
    last_balance_raw TEXT NOT NULL,
    status TEXT NOT NULL,
    reward_cents INTEGER NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    eligible_at TIMESTAMPTZ NOT NULL,
    credited_at TIMESTAMPTZ,
    last_checked_at TIMESTAMPTZ,
    swap_id TEXT,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS holder_verifications_user_status ON holder_verifications (user_id, status)`,
  `CREATE INDEX IF NOT EXISTS holder_verifications_eligible ON holder_verifications (status, eligible_at)`,
  `CREATE TABLE IF NOT EXISTS holder_balance_checks (
    id TEXT PRIMARY KEY,
    verification_id TEXT NOT NULL REFERENCES holder_verifications(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    balance_raw TEXT NOT NULL,
    meets_requirement INTEGER NOT NULL,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS holder_balance_checks_verification ON holder_balance_checks (verification_id, checked_at)`,
  `CREATE INDEX IF NOT EXISTS holder_balance_checks_user ON holder_balance_checks (user_id)`,
  `CREATE TABLE IF NOT EXISTS x402_settlements (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    payer TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    amount_usdg TEXT NOT NULL,
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    actual_cents INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'settled',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS x402_settlements_tx_hash ON x402_settlements (tx_hash)`,
  `CREATE INDEX IF NOT EXISTS x402_settlements_payer ON x402_settlements (payer)`,
  `CREATE INDEX IF NOT EXISTS x402_settlements_created ON x402_settlements (created_at)`,
  `INSERT INTO reward_rules (
    id, version, conversion_bps, min_notional_usd_cents, daily_cap_usd_cents, enabled, active_from
  )
  SELECT 'rule_v1', 1, 50, 25000, 250000, 1, NOW()
  WHERE NOT EXISTS (SELECT 1 FROM reward_rules WHERE version = 1)`,
  `UPDATE reward_rules
   SET min_notional_usd_cents = 25000
   WHERE min_notional_usd_cents = 50000`,
  `ALTER TABLE virtual_keys ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'openai'`,
  `ALTER TABLE virtual_keys ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'gpt-4o-mini'`,
  `CREATE INDEX IF NOT EXISTS ledger_user_account ON ledger_entries (user_id, account)`,
  `CREATE INDEX IF NOT EXISTS ledger_user_account_ref ON ledger_entries (user_id, account, reference_id)`,
  `CREATE TABLE IF NOT EXISTS deposit_intents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    usd_cents INTEGER NOT NULL,
    token_amount_raw TEXT NOT NULL,
    token_amount_human TEXT NOT NULL,
    price_usd TEXT NOT NULL,
    display_credit_cents INTEGER NOT NULL,
    granted_llm_cents INTEGER NOT NULL,
    dex_pair_address TEXT,
    logo_uri TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS deposit_intents_user ON deposit_intents (user_id)`,
  `CREATE INDEX IF NOT EXISTS deposit_intents_status ON deposit_intents (status)`,
  `CREATE TABLE IF NOT EXISTS accr_deposits (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    intent_id TEXT NOT NULL UNIQUE REFERENCES deposit_intents(id),
    tx_hash TEXT UNIQUE,
    token_amount_raw TEXT NOT NULL,
    usd_cents_at_deposit INTEGER NOT NULL,
    display_credit_cents INTEGER NOT NULL,
    granted_llm_cents INTEGER NOT NULL,
    price_usd TEXT NOT NULL,
    dex_pair_address TEXT,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS accr_deposits_user ON accr_deposits (user_id)`,
  `CREATE INDEX IF NOT EXISTS accr_deposits_status ON accr_deposits (status)`,
];

export async function applyMigrations(db: AnyDb) {
  for (const statement of STATEMENTS) {
    await db.execute(sql.raw(statement));
  }
}

export type SchemaTx =
  | PgTransaction<
      NeonQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >
  | PgTransaction<
      PostgresJsQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >
  | PgTransaction<
      PgliteQueryResultHKT,
      typeof schema,
      ExtractTablesWithRelations<typeof schema>
    >;
