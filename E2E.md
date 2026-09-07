# Trade2Credits — end to end

**You swap. We credit.**

This file is the full walk of the live site: what a wallet does, what every page shows, and what happens after credit posts. It matches the product as shipped.

There is no email account. The address that signs in **is** the desk.

---

## One picture

```
Connect wallet
      ↓
Live swap  or  claim a verified hash
      ↓
$250 confirmed swap volume  →  50 bps website credit
      ↓
Convert 1:1
      ├── USDG  →  same EVM wallet on Robinhood Chain
      └── LLM   →  t2c_ key (shown once)
                    ↓
              Official vendor API
              OpenAI / Anthropic / DeepSeek / Google
              Usage burns remaining cents
```

Worked example: **$1,842.60** notional × **50 bps** = **$9.21**.

---

## Published terms

| Term | Value |
| --- | --- |
| Floor | **$250 USD** confirmed **swap** volume before BPS is listed |
| Ratio | **50 bps** (0.50%) of qualifying notional |
| Daily cap | **$2,500** credit per UTC day |
| Minimum redeem | **$1.00** |
| USDG destination | Signed-in EVM address only, **Robinhood Chain** |
| LLM key | `t2c_…`, shown once, hashed after that |

Notional is the **USD value of the fill**, not the token amount. Sends, receives, and approvals do not count toward the floor. A single imported fill still has to be at or above $250 to claim on its own. Changing the rule later does not rewrite booked rows.

---

## Public site

### `/` Landing

Wallet-native marketing. Canvas `#141416`, accent `#c23a3a`, Geist + Geist Mono. Responsive on phone, tablet, and desktop.

| Block | What it says |
| --- | --- |
| Hero | “You swap. We credit.” One CTA: **Connect wallet**. ETH→SOL dither field. |
| Houses | MetaMask, Phantom, Coinbase, LI.FI, Robinhood |
| How it pays | Six steps: connect → swap or scan → $250 floor → 50 bps → claim/convert → one hash |
| Worked example | $1,842.60 → **$9.21** |
| Rails | USDG to the same wallet on Robinhood. LLM = metered `t2c_` key |
| The desk | Swap Studio, Activity, Redeem, Rewards |
| Published numbers | Floor, 50 bps, $2,500 cap, $1 redeem |
| LLM API | Official OpenAI, Anthropic, DeepSeek, Google paths |
| Rules | What the desk will not do |
| FAQ | Who can use it, when a fill pays, how to claim, what redeem returns |
| Account | SIWE / SIWS, health link, **Open the desk** |
| Footer | Product / Desk / Rules, published-ratio tape, **Get started** |

Header jumps: How it pays, Desk, API, FAQ. Phone gets a scrollable link row.

### `/login`

Connect Wallet adapter. Detects installed extensions (MetaMask, Phantom, Coinbase Wallet). Ethereum signs **SIWE**. Solana signs **SIWS**. A login nonce is stored in the database, then consumed. After a good sign-in the session is bound to that address and the browser goes to `/app`.

If Neon or the local database is down, nonce issue fails: “Could not issue a login nonce.”

### Missing and broken pages

| Case | What you see |
| --- | --- |
| Unknown URL | Pixel **404** field — “Page not found.” |
| Offline / network drop | Same pixel **404** — “Network gone.” |
| Render / request failure | Same field with **Try again** |

---

## Signed-in desk

All `/app` routes require a session. The bar is: Balances · Swap · Activity · Chat · Redeem · Ledger.

| Page | What you do |
| --- | --- |
| `/app` | See website credit, USDG, and LLM balances. Convert 1:1. Open swap, claims, or redeem. |
| `/app/swap` | Quote and execute a live fill (LI.FI, or a desk pay-in for Robinhood ETH / pairs LI.FI will not quote). Below $250 the fill still runs; credit is held. |
| `/app/claims` | Scan the last 90 days (when a Zerion key is set) or import a verified hash. Claim posts website credit. |
| `/app/chat` | Talk through the desk. Spends LLM rail / credit the same way a `t2c_` key would. |
| `/app/redeem` | Redeem USDG (queue to this EVM address) or mint a provider-locked `t2c_` key. Key + official SDK snippet shown **once**. |
| `/app/rewards` | Immutable ledger: fills and credit rows. |

Paper fills exist only when `ALLOW_MOCK_SWAPS=true`. That switch is rejected in production.

---

## The money path

1. **Connect** at `/login`.
2. **Fill** in Swap Studio, or **claim** a hash on Activity.
3. Confirmed **swap** volume on that wallet must reach **$250**.
4. Each later qualifying fill (≥ $250, under the daily cap) posts **50 bps** as **website credit**.
5. **Convert** 1:1 to the USDG rail or the LLM rail (redeem can auto-convert from website credit).
6. **Redeem**
   - USDG → payout outbox → session EVM address on Robinhood Chain. Gas is Robinhood ETH. Token is Robinhood USDG.
   - LLM → `t2c_` key for the provider and model you picked.

One `(tx, chain)` never pays twice. A→B→A on the same wallet inside 60 minutes can **hold** credit for review. Release posts it. Reject does not.

---

## LLM keys (what redeem issues)

Redeem locks **provider + model**. The client never sees the pool / Gateway credential.

| Provider | Official contract | Auth |
| --- | --- | --- |
| OpenAI | `POST {origin}/v1/chat/completions` | `Authorization: Bearer t2c_…` |
| DeepSeek | Same chat-completions shape | `Authorization: Bearer t2c_…` |
| Anthropic | `POST {origin}/v1/messages` | `x-api-key: t2c_…` |
| Google | `POST {origin}/v1beta/models/{model}:generateContent` | `x-goog-api-key: t2c_…` |

Also: `GET {origin}/v1/models` (key-scoped). Alias: `/gateway/v1/…`.

```js
import OpenAI from "openai";
const client = new OpenAI({ apiKey: "t2c_…", baseURL: "{origin}/v1" });
await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello" }],
});
```

```js
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: "t2c_…", baseURL: "{origin}" });
await client.messages.create({
  model: "claude-haiku-4-5",
  max_tokens: 16,
  messages: [{ role: "user", content: "Hello" }],
});
```

Default redeem pick is **OpenAI / `gpt-4o-mini`**. Catalog covers Anthropic, OpenAI, DeepSeek, and Google.

Upstream calls go through **Vercel AI Gateway** (`AI_GATEWAY_API_KEY`, or OIDC on Vercel). Optional leftover provider keys are fallbacks only. Desk catalog rates meter the key (minimum **1 cent** per call). Empty pool → `503`. Wrong model for that key → `400`. Bad bearer → `401`. Spent to zero → `402`.

---

## What the desk will not do

- Pay a fill below **$250 USD**.
- Credit the same transaction twice.
- Send USDG anywhere except the signed-in EVM wallet.
- Show a `t2c_` key a second time.
- Invent a second balance. Website credit, USDG, and LLM are one ledger, three rails.
- Treat a paper fill as a live chain swap.

---

## Operator console

`/admin` is gated by `ADMIN_SECRET`.

| Page | Purpose |
| --- | --- |
| `/admin` | Liability vs pools, live reward rule (disable is a kill switch) |
| `/admin/rules` | Floor, bps, daily cap |
| `/admin/flags` | Held fills — release or reject |
| `/admin/payouts` | USDG queue |
| `/admin/ledger` | Operator ledger |
| `/admin/exchanges` | Exchange rows |

`GET /api/v1/health` reports database, Redis (required in production), and whether treasury can broadcast.

---

## Run it

```bash
cp .env.example .env.local
# set SESSION_SECRET (32+ chars). Do not commit .env.local.
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Full stack (Postgres, Redis, minute jobs):

```bash
docker compose up --build
```

Host Next, Docker data only:

```bash
docker compose up postgres redis
```

Then point `.env.local` at `postgresql://t2c:t2c@localhost:5432/trade2credits` and `redis://localhost:6379`.

| Variable | Why |
| --- | --- |
| `SESSION_SECRET` | Sign sessions |
| `APP_ORIGIN` / `NEXT_PUBLIC_APP_URL` | SIWE domain and public URL |
| `DATABASE_URL` | Neon / Postgres. Empty locally uses on-disk PGlite |
| `REDIS_URL` | Rate limits. Required in production |
| `AI_GATEWAY_API_KEY` | One key for OpenAI, Anthropic, DeepSeek, Google |
| `LIFI_API_KEY` | Optional. Public quotes still work |
| `ZERION_API_KEY` | Shared 90-day scan. Without it, import a hash |
| `TREASURY_*` / `REWARD_VAULT_ADDRESS` | Robinhood USDG on-chain claims. Private key stays server-only |
| `ADMIN_SECRET` | Operator console |
| `CRON_SECRET` | Payout and settle jobs |
| `ALLOW_MOCK_SWAPS` | Local paper fills only |

Never put treasury or vendor keys in git or an image.

## Production

Frontend and API are one Next.js build. Before a deploy:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

`GET /api/v1/health` must report database + Redis. Production also requires `CRON_SECRET`.

Vercel: push `main`. Set the production secrets on the project. Minute jobs are already in `vercel.json`.

Docker:

```bash
cp .env.production.example .env.production
docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d
```

---

## Walk it once

1. Open `/`. Read How it pays, limits, API, FAQ.
2. **Connect wallet** → `/login` → sign.
3. `/app/swap` — run a qualifying fill, **or** `/app/claims` — import / scan and claim.
4. `/app` — website credit is there.
5. `/app/redeem` — USDG to this wallet, **or** LLM and copy the `t2c_` key.
6. Call `{origin}/v1/chat/completions` (or `/v1/messages` for Claude). Remaining cents drop.
7. `/app/chat` spends the same rail from the desk.
8. `/app/rewards` shows the rows. A second claim on the same hash does nothing.
9. Pull the network: pixel **404**. Open a missing URL: same field.
