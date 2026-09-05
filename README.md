# Trade2Credits

Wallet-only rewards desk. Qualifying token swaps ($500+ USD notional) convert at a published ratio into **USDT** or **LLM credits**.

Phases 0–3 are in this repo: landing, wallet login, LI.FI swap + historical claims, and redeem (USDT outbox + LLM virtual keys).

## Run

```bash
cp .env.example .env.local
# set SESSION_SECRET to 32+ random chars
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Connect a wallet on `/login`, then record a paper fill on `/app/swap`.

`ALLOW_MOCK_SWAPS=true` is required for paper fills and is rejected in production.

## Phase 3

`/app/redeem` debits the ledger once. USDT writes `payout_outbox` for Arbitrum (destination = signed-in wallet). Nothing is broadcast unless `TREASURY_ENABLED=true`, `TREASURY_PRIVATE_KEY` is set, and (in production) `TREASURY_LIVE=true`. LLM credits issue a `t2c_` key — sha256 is stored, plaintext is shown once.

OpenAI-compatible gateway (no cookie / no same-origin check):

```bash
POST /gateway/v1/chat/completions
Authorization: Bearer t2c_...
```

Set any OpenAI-compatible client base URL to `{APP_ORIGIN}/gateway/v1`. If `OPENAI_API_KEY` is missing, redeem still issues keys and the gateway returns 503. Admin drain: `POST /v1/admin/payouts/process` with `ADMIN_SECRET`.

## Phase 2

`/app/claims` scans the signed-in wallet (Zerion, last 90 days, when `ZERION_API_KEY` is set) and accepts a verified hash import. Claim re-checks ownership and USD, then writes the same ledger as a live swap. One reward per `(tx_hash, from_chain)`.

## Phase 1

Signed-in desk at `/app/swap` quotes through our API (`POST /v1/swaps/quote`), executes with the LI.FI SDK in the wallet, then settles via `POST /v1/swaps/settle`. The server reads USD notional from LI.FI status and checks `fromAddress` against the session. Client-typed amounts are not trusted.

## Phase 0 surface

- `GET /` landing
- `GET /login` EIP-6963 + Phantom Solana
- `GET /app` balances
- `POST /v1/auth/nonce` `POST /v1/auth/verify` `POST /v1/auth/logout`
- `GET /v1/wallet`
- `POST /v1/swaps/confirm` (paper fill, auth + origin + rate limit)
- `POST /v1/admin/reward-rules` (Bearer `ADMIN_SECRET`)

## Security notes

- Account = wallet. Session is an httpOnly JWT plus a revocable server row.
- Nonces are one-time, address-bound, and expire in 10 minutes.
- Mutating `/v1` routes require a matching `Origin` / `Referer`. The `/gateway` path does not — it authenticates with a `t2c_` key and is CORS-open for CLI clients.
- Virtual keys store sha256 only. USDT withdraws only to the signed-in EVM wallet.
- Money is integer cents. Balances are derived from `ledger_entries`.
- One reward per `(tx_hash, from_chain)`.
- Paper confirm is compile-time disabled when `NODE_ENV=production`.
- Treasury never broadcasts unless `TREASURY_ENABLED` + `TREASURY_PRIVATE_KEY` (and `TREASURY_LIVE` in production).
