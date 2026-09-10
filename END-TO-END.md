# Accrued — complete end-to-end reference

**You swap. We credit.**

This is the **full technical and product reference** for **Accrued** as shipped today. It covers every page, every money path, every API, database tables, operator tools, deployment, and a demo script you can turn into an article.

| | |
| --- | --- |
| **Public brand** | Accrued |
| **Tagline** | You swap. We credit. |
| **Live URL** | `https://trade2credits.onrender.com` (update `APP_ORIGIN` when you move domains) |
| **User docs** | `/docs` (14 pages, search, TOC) |
| **Repo package** | `trade-to-credits` (internal npm name) |
| **Stack** | Next.js 16, React 19, TypeScript, Drizzle, Postgres/PGlite, Redis, wagmi/viem |

There is **no email account**. The wallet address that signs in **is** the desk.

---

## Table of contents

### Product
1. [Executive summary](#1-executive-summary)
2. [Published terms and math](#2-published-terms-and-math)
3. [The money path](#3-the-money-path)
4. [Three balances, one ledger](#4-three-balances-one-ledger)

### User experience
5. [Landing page `/`](#5-landing-page-)
6. [Connect wallet `/login`](#6-connect-wallet-login)
7. [Docs site `/docs`](#7-docs-site-docs)
8. [Desk `/app`](#8-desk-app)
9. [USDG rail (deep dive)](#9-usdg-rail-deep-dive)
10. [LLM rail and `acc_` keys (deep dive)](#10-llm-rail-and-acc_-keys-deep-dive)
11. [Desk Chat](#11-desk-chat)

### Flows (step by step)
12. [Swap flow: quote → execute → settle](#12-swap-flow-quote--execute--settle)
13. [Claim flow: scan → import → claim](#13-claim-flow-scan--import--claim)
14. [Convert flow](#14-convert-flow)
15. [Redeem flow](#15-redeem-flow)
16. [LLM gateway usage flow](#16-llm-gateway-usage-flow)

### Platform
17. [Authentication and sessions](#17-authentication-and-sessions)
18. [Database schema](#18-database-schema)
19. [Fraud, wash holds, and caps](#19-fraud-wash-holds-and-caps)
20. [HTTP API — complete reference](#20-http-api--complete-reference)
21. [Operator console `/admin`](#21-operator-console-admin)
22. [Background jobs and webhooks](#22-background-jobs-and-webhooks)

### Engineering
23. [Architecture](#23-architecture)
24. [Environment variables (complete)](#24-environment-variables-complete)
25. [Security model](#25-security-model)
26. [Design and brand](#26-design-and-brand)
27. [Local development](#27-local-development)
28. [Production, CI/CD, and health](#28-production-cicd-and-health)
29. [Test coverage](#29-test-coverage)
30. [Repository map](#30-repository-map)

### Demo
31. [Hands-on walkthrough (article script)](#31-hands-on-walkthrough-article-script)
32. [Article angles and talking points](#32-article-angles-and-talking-points)
33. [Glossary](#33-glossary)

---

## 1. Executive summary

**Accrued** is a wallet-native rewards desk. Qualifying token **swaps** convert at a **published ratio** (50 bps) into **website credit**. That credit can be taken as:

1. **USDG** — on-chain vault claim to the **same EVM wallet** on **Robinhood Chain** (chain ID 4663)
2. **LLM credits** — a metered **`acc_` virtual API key** for OpenAI, Anthropic, DeepSeek, Google, or Grok-compatible clients

**Partners named on site:** MetaMask, Phantom, Coinbase, Robinhood.

**What makes it different:**
- No username/password — SIWE (Ethereum) or SIWS (Solana)
- No opaque points — published floor ($250), ratio (50 bps), daily cap ($2,500)
- No second balance — website credit, USDG, and LLM are **one ledger**, three **rails**
- No vendor keys in the browser — `acc_` keys proxy through Vercel AI Gateway; upstream credentials stay server-side

---

## 2. Published terms and math

Source: `src/lib/rules/constants.ts`, enforced by `src/lib/rules/engine.ts`.

| Term | Code constant | Value |
| --- | --- | --- |
| Floor | `MIN_NOTIONAL_USD_CENTS` | **$250** (25,000 cents) confirmed **swap** volume |
| Ratio | `DEFAULT_CONVERSION_BPS` | **50 bps** (0.50%) |
| Min reward | `MIN_REWARD_CENTS` | **$1.00** (100 cents) |
| Daily cap | `DEFAULT_DAILY_CAP_USD_CENTS` | **$2,500** (250,000 cents) per UTC day |
| BPS bounds | `MIN/MAX_CONVERSION_BPS` | 25–100 (admin can version rules) |

### Reward formula

```
rewardCents = floor(notionalUsdCents × conversionBps / 10_000)
```

**Worked example:** $1,842.60 notional × 50 bps = **$9.21** (921 cents)

### What counts toward the $250 floor

- **Counts:** confirmed **swap/trade/execute** volume on the connected wallet
- **Does not count:** sends, receives, approvals
- **Single hash claim:** that fill alone must be ≥ $250
- **Scan aggregate:** cumulative swap volume can cross $250; then qualifying fills pay

### What does not change retroactively

Once a ledger row posts, changing admin rules does **not** rewrite historical credit.

---

## 3. The money path

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. CONNECT                                                       │
│    /login → SIWE (EVM) or SIWS (Solana) → session cookie         │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ 2. EARN CREDIT                                                   │
│    Path A: /app/swap → quote → wallet tx → settle → postSwapReward│
│    Path B: /app/claims → scan/import → claim → postSwapReward    │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3. WEBSITE CREDIT (user_credits account)                         │
│    Visible on /app as "website credit"                             │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ 4. CONVERT (optional, 1:1)                                       │
│    website credit → USDG rail (user_usdt)                        │
│    website credit → LLM rail (user_llm) — or skip via redeem auto │
└────────────────────────────┬─────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│ 5. REDEEM                                                        │
│    USDG: payout_outbox → vault claim → same EVM wallet           │
│    LLM:  mint acc_ key (shown once) → vendor API → meter usage     │
└──────────────────────────────────────────────────────────────────┘
```

### Swap outcome statuses (`postSwapReward`)

| Status | Meaning |
| --- | --- |
| `rewarded` | Credit posted to website credit |
| `below_threshold` | Fill recorded; under $250 alone / no credit |
| `held` | Wash round-trip detected; awaits admin review |
| `capped` | Daily cap exhausted for UTC day |
| `paused` | Reward rule disabled (kill switch) |
| `rejected` | Admin rejected held fill |

---

## 4. Three balances, one ledger

| UI label | Ledger account | What it is |
| --- | --- | --- |
| Website credit | `user_credits` | Reward after claim; not yet on a spend rail |
| USDG | `user_usdt` | Credit earmarked for on-chain USDG claim |
| LLM credits | `user_llm` | Credit earmarked for key mint or Chat |

**Other ledger accounts (system):** `rewards_expense`, `payout_pool`, `redemption_pool`, `desk_chat_hold`

**Cache:** `wallets` table mirrors the three user-facing cents columns for fast reads.

**Convert** moves value **1:1** between rails (the 50 bps fee already applied at claim).

**Important:** Direct convert to `llm_credits` from website credit is **rejected** (`llm_redeem_required`). LLM spending path is: convert to LLM rail via redeem auto-convert, or redeem flow that debits LLM rail.

---

## 5. Landing page `/`

**Brand:** Accrued shown on all breakpoints via `BrandMark` (dot grid + wordmark). No abbreviations.

**Design:** Canvas `#141416`, accent `#c23a3a`, Geist + Geist Mono.

### Header (sticky)

| Element | Behavior |
| --- | --- |
| Logo | **Accrued** → `/` |
| Nav | How it pays `#mechanics` · Desk `#desk` · API `#api` · Docs `/docs` · FAQ `#faq` |
| CTA | **Connect wallet** → `/login` |
| Mobile | Scrollable link row under header |

### Hero `[01] Wallet-native rewards`

| Element | Detail |
| --- | --- |
| Headline | **You swap. We credit.** |
| Body | Qualifying $250+ fills at published ratio → USDG or LLM |
| Metrics strip | 50 bps · $250 floor · $2,500 daily cap |
| **Get started** | `PeekAccountButton` — LLM logos peek on hover; scrolls to `#mechanics` |
| **How it pays** | Ghost link → `/docs/how-it-pays` |
| **Credit calculator** | Slider $250–$25k; shows **Swap notional** → **Reward** at 50 bps |
| Footnote | Detected from extension · signed with SIWE / SIWS |
| **Ratio tape** | Interactive dither canvas; ETH→SOL default; hover → SWAP = CREDITS |

### Wallet houses row

MetaMask · Phantom · Coinbase · Robinhood (trust strip, not functional links)

### `[04] How it pays` — `#mechanics`

Six animated step cards:
1. Connect the wallet
2. Swap live, or scan history
3. Clear the $250 floor
4. Convert at 50 bps
5. Claim, then convert
6. One hash, one credit

**Worked example block:** $1,842.60 × 50 bps = **$9.21**

### `[05] Rails` — `#rails`

- **USDG:** same wallet, Robinhood Chain, redeem from desk
- **LLM:** metered `acc_` key, usage burns balance

### `[06] The desk` — `#desk`

Links to four desk pages: Swap Studio, Activity, Redeem, Rewards (ledger)

### Published numbers — `#limits`

Live floor, bps, daily cap, redeem minimum

### LLM API — `#api`

Provider matrix: OpenAI, Anthropic, DeepSeek, Google, Grok — paths and auth headers

### Rules — `#rules`

What the desk will not do (no double credit, no second balance, key shown once, etc.)

### FAQ — `#faq`

Who can use it, when a swap pays, old hashes, after redeem + link to full docs

### Account — `#account`

SIWE/SIWS note, health check link, **Open the desk** (`PeekAccountButton` → `/login`)

### Footer `[12] Close`

Brand, nav columns (Product / Desk / Rules), published-ratio tape, **Connect wallet**, contract link, social buttons

---

## 6. Connect wallet `/login`

**Title:** Connect wallet — Accrued

### UI

- Full-viewport wallet grid background
- Pixel ETH octahedron art (desktop + mobile variants)
- Decorative ASCII: **ACCRUED / REWARDS**, WALLET CONNECT, etc.
- Header: **Accrued** brand mark (accent tone)
- Center: **Connect wallet** with LLM peek animation
- Opens wallet card: MetaMask, Phantom, Coinbase Wallet

### Sign-in protocol

| Chain | Method | Statement |
| --- | --- | --- |
| EVM | **SIWE** (EIP-4361) | "Accrued wants you to sign in" |
| Solana | **SIWS** | Same intent via Phantom |

### Server flow

1. `POST /api/v1/auth/nonce` — stores nonce in `auth_nonces`, returns `{ nonce, issuedAt, expirationTime }`
2. Wallet signs message including nonce + domain (`APP_ORIGIN`)
3. `POST /api/v1/auth/verify` — validates signature, creates `users` + `sessions` row, sets cookie
4. Redirect → `/app`

### Failure modes

- DB down: "Could not issue a login nonce"
- Wrong wallet on swap: session address must match tx signer
- Solana session: can use LLM + Chat; **cannot** USDG redeem (EVM-only)

---

## 7. Docs site `/docs`

Vercel-style documentation shell.

### Shell features

- Sticky header: **Accrued** · **Accrued Docs** · Connect wallet · Open desk
- Left sidebar: grouped nav (Start here / The desk / Take credit / Rules)
- Center: page content with `DocsH1`, callouts, code blocks
- Right: table of contents (`DocsToc`) from page headings
- Search: ⌘K (`DocsSearch`) indexes all 14 pages
- Footer pager: prev/next (`DocsPager`)

### All pages

| Path | Title | Section |
| --- | --- | --- |
| `/docs` | Introduction | Start here |
| `/docs/how-it-pays` | How it pays | Start here |
| `/docs/connect` | Connect a wallet | Start here |
| `/docs/swap` | Swap Studio | The desk |
| `/docs/activity` | Activity | The desk |
| `/docs/balances` | Balances and convert | The desk |
| `/docs/chat` | Chat | The desk |
| `/docs/ledger` | Ledger | The desk |
| `/docs/usdg` | USDG | Take credit |
| `/docs/llm` | LLM credits | Take credit |
| `/docs/api` | API | Take credit |
| `/docs/limits` | Published numbers | Rules |
| `/docs/rules` | What the desk will not do | Rules |
| `/docs/faq` | FAQ | Rules |

Each page SEO title: `{Page} — Accrued Docs`

---

## 8. Desk `/app`

**Gate:** `getSession()` in layout — no session → redirect `/login`

**Header:** **Accrued · Desk** + nav + truncated address + Sign out

### Navigation

| Route | Label | Component | Purpose |
| --- | --- | --- | --- |
| `/app` | Balances | `ConvertDesk`, banners | Three balances; convert credit→USDG |
| `/app/swap` | Swap | `SwapStudio`, `PaperFillForm`* | Live swap quote/execute/settle |
| `/app/claims` | Activity | `ClaimsInbox` | Scan, import, claim |
| `/app/chat` | Chat | `DeskChat` | In-browser LLM chat |
| `/app/redeem` | Redeem | `RedeemDesk` | USDG or LLM key |
| `/app/rewards` | Ledger | server page | Immutable ledger + swaps list |

\*Paper fill only when `ALLOW_MOCK_SWAPS=true` (dev)

### `/app` — Balances (`ConvertDesk`)

**States:** form → review → working → success / error

- Shows website credit, USDG, LLM cents
- Convert **website credit → USDG rail** only (1:1)
- Minimum $1.00
- Idempotency key generated per review session
- Links to swap, claims, chat, redeem

### `/app/swap` — Swap Studio

**Default pair:** Base → Robinhood (when supported)

**Phases:** idle → quoting → executing → settling → success / error

**Swap router path** (in-wallet fill):
1. Pick chains/tokens/amount
2. `POST /api/v1/swaps/quote`
3. Wallet signs through **AccruedSwapRouter** (`0xc78e883f…`) → Uniswap V3 SwapRouter02; emits `AccruedSwap` for Dune/DeFiLlama
4. `POST /api/v1/swaps/settle` with tx hash (settle verifies `AccruedSwap` event)
5. Poll up to 24×5s if 202 pending

**Desk pay-in path** (Robinhood ETH or pairs the swap router cannot quote; also used as fallback):
1. Quote returns internal slug `provider: "changenow"` — UI label **Desk pay-in**
2. `POST /api/v1/swaps/changenow/create` → pay-in address
3. User sends deposit tx to that address
4. Settle with `exchangeId` + deposit tx hash

**Rules shown on quote:** estimated reward, qualifies flag, paused flag

### `/app/claims` — Activity

- **Scan wallet:** 90-day Zerion scan (requires `ZERION_API_KEY`); 15-min cooldown
- **Import hash:** manual tx + chains; verified via swap-router status, then Zerion fallback
- **Volume summary:** cumulative swap volume toward $250 floor
- **Claim button** per unclaimed row → posts credit once

### `/app/redeem` — Redeem Desk

**Rails:**
- **USDG** (EVM sessions only)
- **LLM credits** (all sessions)

**USDG flow:**
- Pick amount (max **$5.00** per claim, 30-min cooldown per wallet)
- Queues `payout_outbox`
- Optional auto wallet `claim()` with EIP-712 voucher
- Shows queued vs on-chain fulfilled

**LLM flow:**
- Pick provider + model (`LlmModelPicker`)
- Redeem debits LLM rail (auto-converts from website credit if needed)
- Shows **`acc_` plaintext key once** + SDK snippet
- Lists existing keys (prefix only) with revoke

### `/app/chat` — Desk Chat

- Sidebar threads (localStorage `t2c.desk-threads.v1`)
- Model/provider picker
- Requires spendable LLM rail balance (from redeemed keys)
- `POST /api/v1/desk-chat` streams response; burns cents

### `/app/rewards` — Ledger

- Recent `ledger_entries` rows
- Recent `swaps` (fills) with status
- Read-only audit trail

---

## 9. USDG rail (deep dive)

### Chain and token

| | |
| --- | --- |
| Chain | Robinhood Chain, ID **4663** |
| RPC | `https://rpc.mainnet.chain.robinhood.com` |
| Explorer | `https://robinhoodchain.blockscout.com` |
| USDG token | `0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168` |
| Gas | Robinhood ETH |
| Desk pay-in network code (Robinhood) | `hood` |

### Vault contract (`UsdgRewardVault`)

- Deploy: `npm run deploy:reward-vault` → set `REWARD_VAULT_ADDRESS`
- Default in code: `0x991FA150A5Cf1680d41137a38bEAa9Eaa0eBE1db` (override via env)

**User claim path:**
```
claim(redemptionId, amount, deadline, signature)
```
- EIP-712 typed data signed by treasury
- 7-day deadline typical
- Claim ID: `keccak256(stringToHex(redemptionId))`
- USDG 6 decimals: `amountCents × 10^4` on-chain units

**Treasury path:**
```
payClaim(redemptionId, recipient, amount)
```

A raw USDG `transfer` is **not** a reward claim.

### Redeem limits (`src/lib/redeem/limits.ts`)

| Limit | Value |
| --- | --- |
| Max per claim | **$5.00** (`MAX_USDG_REDEEM_CENTS = 500`) |
| Cooldown | **30 minutes** per wallet |

### Production gates

| Env | Required for live on-chain |
| --- | --- |
| `TREASURY_ENABLED=true` | Allow treasury to act |
| `TREASURY_LIVE=true` | Production broadcast |
| `TREASURY_PRIVATE_KEY` | Signs vouchers + payClaim |
| `REWARD_VAULT_ADDRESS` | Vault contract |

Until live: redeem **books on desk**, shows **queued**, not settled on-chain.

### Confirm on-chain

`POST /api/v1/redeem/{id}/confirm` with `{ txHash }` — waits for receipt, verifies vault `claimed(claimId)`, marks redemption fulfilled.

---

## 10. LLM rail and `acc_` keys (deep dive)

### Virtual key format

- **New keys:** `acc_{48 hex chars}` (24 random bytes)
- **Legacy keys:** `t2c_…` still authenticate at gateway
- **Storage:** SHA-256 hash only after first display; prefix stored for UI

### Providers and defaults

| Provider | Default model | Gateway slug example |
| --- | --- | --- |
| **openai** (default) | `gpt-4o-mini` | `openai/gpt-4o-mini` |
| anthropic | catalog pick | `anthropic/claude-haiku-4.5` |
| deepseek | catalog pick | `deepseek/...` |
| google | catalog pick | `google/gemini-2.5-flash` |
| grok | catalog pick | `xai/grok-4.6` |

Full catalog: `src/lib/gateway/catalog.ts` (100+ models)

Redeem **locks provider + model** on the key. Wrong model → HTTP 400.

### Official API contracts

| Provider | Endpoint | Auth |
| --- | --- | --- |
| OpenAI, DeepSeek, Grok | `POST /v1/chat/completions` | `Authorization: Bearer acc_…` |
| Anthropic | `POST /v1/messages` | `x-api-key: acc_…` |
| Google | `POST /v1beta/models/{model}:generateContent` | `x-goog-api-key: acc_…` |
| All | `GET /v1/models` | Same key |

**Aliases:** `/gateway/v1/*` mirrors `/v1/*`

### Upstream routing

1. Client presents `acc_` key to Accrued origin
2. Gateway validates hash, checks spend cap
3. Request forwarded to **Vercel AI Gateway** (`AI_GATEWAY_API_KEY` or Vercel OIDC)
4. Fallback: per-provider env keys if Gateway unset
5. Usage estimated in cents (catalog rates); min **1 cent** per call
6. Response headers: `X-Accrued-Remaining-Cents`, `X-Accrued-Provider`, `X-Accrued-Spend-Cap-Cents`

### Gateway HTTP errors

| Code | Meaning |
| --- | --- |
| 401 | Invalid/missing key |
| 402 | Insufficient credits on key |
| 400 | Wrong model for locked provider |
| 503 | Provider pool / Gateway not configured |

### OpenAI SDK example

```js
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "acc_…",
  baseURL: "https://your-origin.com/v1",
});

const res = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello" }],
});
```

### Anthropic SDK example

```js
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: "acc_…",
  baseURL: "https://your-origin.com",
});

await client.messages.create({
  model: "claude-haiku-4-5",
  max_tokens: 256,
  messages: [{ role: "user", content: "Hello" }],
});
```

### Key lifecycle

1. Redeem LLM → plaintext shown **once**
2. Hash stored in `virtual_keys`
3. Usage increments `spend_used_cents`
4. Revoke via UI or `POST /api/v1/virtual-keys/{id}/revoke`
5. Key cannot be re-displayed — mint new key from remaining credit

---

## 11. Desk Chat

**Route:** `/app/chat`

**Purpose:** Talk to models inside the desk without pasting a key into an external client.

| | Chat | Redeem key |
| --- | --- | --- |
| Where | Browser UI | Cursor, CLI, any SDK |
| Auth | Session cookie | `acc_` bearer |
| Spends | LLM rail via desk-chat holds | Virtual key cap |
| Threads | localStorage | N/A |

**Requirement:** Must have LLM rail balance (redeem first).

**API:** `GET/POST /api/v1/desk-chat`

**Error if no credits:** "Redeem LLM credits first…"

---

## 12. Swap flow: quote → execute → settle

### Naming: what users see vs what the API stores

Accrued does **not** surface third-party swap brands in the product UI or docs. Two execution backends are renamed as follows:

| User-facing name | Where it appears | Internal API slug | Notes |
| --- | --- | --- | --- |
| **Swap router** | Swap Studio route label, docs, error copy | `"lifi"` | In-wallet quote + sign; usual EVM pairs |
| **Desk pay-in** | Swap Studio when Robinhood or fallback; admin **Pay-in routes** | `"changenow"` | Deposit to a pay-in address; payout lands on the same wallet |

Legacy route and env names (`/webhooks/lifi`, `LIFI_*`, `/swaps/changenow/create`, `CHANGENOW_*`, `src/lib/lifi/`) are **internal wiring only** — treat them as implementation details, not product language.

### Router logic (`src/lib/swap/router.ts`)

```
If Robinhood (4663) involved              → Desk pay-in only
Else if both chains in swap-router list   → Swap router (fallback Desk pay-in on quote error)
Else                                      → 400 unsupported
```

**Swap-router supported chain IDs:** 1, 10, 56, 137, 42161, 8453, 43114, 59144, 534352, 81457. Robinhood (4663) and some missing pairs use **Desk pay-in** instead.

### Step 1 — Quote

```http
POST /api/v1/swaps/quote
Authorization: session cookie
Content-Type: application/json

{
  "fromChainId": 8453,
  "toChainId": 4663,
  "fromToken": "0x…",
  "toToken": "0x…",
  "fromAmount": "1000000000000000000"
}
```

**Response (Swap router — slug `lifi`):**
```json
{
  "provider": "lifi",
  "quote": { … },
  "fromAmountUsdCents": 250000,
  "estimatedRewardCents": 1250,
  "qualifies": true,
  "paused": false,
  "rule": { "conversionBps": 50, "minNotionalUsdCents": 25000, … }
}
```

**Auth:** session required, **EVM only**, same-origin, rate limit 30/15min

### Step 2 — Execute (client)

- **Swap router:** wallet signs the quoted route — session address must match connected wallet
- **Desk pay-in:** open pay-in route, send deposit to returned address

### Step 3 — Create desk pay-in (if applicable)

```http
POST /api/v1/swaps/changenow/create
{ same body as quote }
```

Returns `exchangeId`, `payinAddress`, amounts, token address.

### Step 4 — Settle

```http
POST /api/v1/swaps/settle

// Swap router (slug lifi)
{ "provider": "lifi", "txHash": "0x…", "fromChain": "8453", "toChain": "4663" }

// Desk pay-in (slug changenow)
{ "provider": "changenow", "txHash": "0x…", "exchangeId": "…", "fromChain": "…", "toChain": "…" }
```

| HTTP | Meaning |
| --- | --- |
| 200 | Fill verified → `postSwapReward` ran |
| 202 | Pending → row in `pending_settles`; cron/UI polls |
| 4xx | Verification failed |

### Step 5 — `postSwapReward`

Creates `swaps` row (unique on `tx_hash + from_chain`), runs wash check, applies rule, writes `credit_events` + `ledger_entries`, updates `wallets` cache.

**Sources:** `in_app` | `historical` | `mock`

### Dev-only mock

```http
POST /api/v1/swaps/confirm
```
Requires `ALLOW_MOCK_SWAPS=true`. Rejected in production.

---

## 13. Claim flow: scan → import → claim

### Scan

```http
POST /api/v1/swaps/scan
```

- Requires `ZERION_API_KEY` for live API
- 90-day window
- 15-minute cooldown per user (`wallet_scans`)
- Shared key queued at **2 req/sec**
- Inserts `discovered_swaps` rows

### Import

```http
POST /api/v1/swaps/import

{ "txHash": "0x…", "fromChain": "8453", "toChain": "1" }
```

Verifies via swap-router fill status, then Zerion fallback.

### List claims

```http
GET /api/v1/swaps/claims
```

Returns `{ claims[], summary, paused, rule, autoScan }`

Volume summary sums **trade/execute** kinds only.

### Claim one

```http
POST /api/v1/swaps/claims/{id}/claim
```

- ID format: `disc_{uuid}`
- Re-verifies hash
- Enforces per-fill $250 floor
- `postSwapReward(source: "historical")`
- Marks `discovered_swaps.status = "claimed"`

### Volume aggregate reward

When cumulative scanned swap volume crosses $250, `settleScannedVolumeReward` can post synthetic credit (`tx_hash = volume:{userId}`).

---

## 14. Convert flow

```http
POST /api/v1/credits/convert
Content-Type: application/json

{
  "rail": "usdt",
  "amountCents": 500,
  "idempotencyKey": "cnv_abc123"
}
```

| Field | Rule |
| --- | --- |
| `rail` | `"usdt"` only from UI (LLM convert rejected at API) |
| `amountCents` | ≥ 100 ($1.00) |
| `idempotencyKey` | Unique per user; safe retry |

**Response:**
```json
{
  "alreadyExists": false,
  "conversionId": "cnv_…",
  "rail": "usdt",
  "amountCents": 500,
  "creditCents": 4500,
  "usdtCents": 500,
  "llmCents": 0
}
```

**Ledger:** debit `user_credits`, credit `user_usdt` (1:1)

**UI:** ConvertDesk shows review panel before POST.

---

## 15. Redeem flow

```http
POST /api/v1/redeem
Content-Type: application/json

{
  "rail": "llm_credits",
  "amountCents": 500,
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000",
  "provider": "openai",
  "model": "gpt-4o-mini"
}
```

USDG omit `provider`/`model`. LLM requires both.

### Server steps

1. Idempotency check on `(user_id, idempotency_key)`
2. Auto-convert from `user_credits` if rail balance insufficient (`rdm_{idempotencyKey}`)
3. Debit rail account; credit pool account
4. **LLM:** instant fulfill → mint `virtual_keys` → return `plaintextKey` **once**
5. **USDG:** status `queued` → insert `payout_outbox` → sign EIP-712 voucher if treasury ready

### List / detail

```http
GET /api/v1/redeem
GET /api/v1/redeem/{id}
```

Detail includes `onChainClaim` voucher for USDG.

### Confirm on-chain USDG

```http
POST /api/v1/redeem/{id}/confirm
{ "txHash": "0x…" }
```

---

## 16. LLM gateway usage flow

```
Redeem LLM → acc_ plaintext (once)
       ↓
Client SDK → https://origin/v1/chat/completions
       ↓
authenticateVirtualKey (hash lookup)
       ↓
Reserve spend cap → forward to AI Gateway
       ↓
Estimate usage cents → debit virtual_keys.spend_used_cents
       ↓
Return provider response + X-Accrued-Remaining-Cents
```

**Revoke:** `POST /api/v1/virtual-keys/{id}/revoke` — key status → revoked, no further calls.

---

## 17. Authentication and sessions

### Cookies (internal names)

| Cookie | Purpose |
| --- | --- |
| `t2c_session` | User JWT session (7 days, httpOnly) |
| `t2c_admin` | Operator session (8 hours) |

Public brand is Accrued; cookie names are legacy infrastructure.

### Session contents

- Bound to `users.id`
- Chain namespace: `eip155` or `solana`
- Address checks on swap (must match signer)

### Auth endpoints

| Method | Path | Auth | Body / response |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/nonce` | Same-origin | → `{ nonce, issuedAt, expirationTime }` |
| POST | `/api/v1/auth/verify` | Same-origin | `{ chainNamespace, address, message, signature }` → session |
| GET | `/api/v1/auth/session` | Cookie | Refresh / validate |
| POST | `/api/v1/auth/logout` | Cookie | Clear session |

### Route protection

- **`/app/*`:** `getSession()` in layout → redirect `/login`
- **API routes:** per-handler session check
- **Admin:** `ADMIN_SECRET` via cookie or `Authorization: Bearer`
- **Cron:** `Authorization: Bearer $CRON_SECRET`
- **Gateway:** virtual key in Authorization / x-api-key / x-goog-api-key
- **CSRF:** `assertSameOrigin` on mutating routes

No Next.js middleware file is wired; protection is layout + API handlers.

---

## 18. Database schema

Source: `src/lib/db/schema.ts`. Migrations: `src/lib/db/migrate.ts`.

### Entity relationship (simplified)

```
users ─┬─ wallets (1:1 cache)
       ├─ sessions
       ├─ swaps (fills)
       ├─ discovered_swaps
       ├─ ledger_entries
       ├─ credit_events
       ├─ credit_conversions
       ├─ redemptions ─┬─ virtual_keys
       │               └─ payout_outbox
       ├─ fraud_flags
       ├─ pending_settles
       └─ changenow_exchanges   (desk pay-in rows; internal table name)

reward_rules (versioned policy)
auth_nonces (login)
wallet_scans (scan metadata)
```

### Table reference

| Table | Unique constraints | Purpose |
| --- | --- | --- |
| `users` | `(chain_namespace, address)` | Wallet identity |
| `wallets` | `user_id` PK | Balance cache |
| `swaps` | `(tx_hash, from_chain)` | Booked fills |
| `discovered_swaps` | `(tx_hash, from_chain)` | Scan/import inbox |
| `credit_events` | `swap_id` | One reward event per swap |
| `ledger_entries` | — | Double-entry log |
| `credit_conversions` | `(user_id, idempotency_key)` | Convert idempotency |
| `redemptions` | `(user_id, idempotency_key)` | Redeem idempotency |
| `virtual_keys` | `key_hash` | Hashed LLM keys |
| `payout_outbox` | `redemption_id` | USDG queue |
| `pending_settles` | `(provider, tx_hash)` | Async settle poll |
| `fraud_flags` | — | Wash holds |
| `reward_rules` | versioned | Active policy |
| `changenow_exchanges` | `exchange_id` | Desk pay-in route tracking (internal table name) |

### Ledger accounts

| Account | User-facing? |
| --- | --- |
| `user_credits` | Website credit |
| `user_usdt` | USDG rail |
| `user_llm` | LLM rail |
| `rewards_expense` | System |
| `payout_pool` | System |
| `redemption_pool` | System |
| `desk_chat_hold` | Chat reservation |

---

## 19. Fraud, wash holds, and caps

### Wash detection (`src/lib/fraud/wash.ts`)

| Parameter | Value |
| --- | --- |
| Window | **60 minutes** |
| Pattern | Round-trip A→B then B→A (token swap) |
| Chain logic | Same-chain bounce OR cross-hop back |

**On detection:**
- Swap status → `held`
- `fraud_flags` row: `reason: wash_round_trip`, `status: open`
- **No credit** until admin action

**Admin resolve:**
- **Release** → credit posts, flag closed, swap → `rewarded`
- **Reject** → swap → `rejected`, flag closed

### Daily cap

Credit amount = `min(computedReward, remainingDailyCap)`. If zero → status `capped`.

### Paused rules

Admin disables `reward_rules.enabled` → all new rewards status `paused`.

### Auto-closed flags (audit)

`rewards_paused`, `below_threshold`, `capped` — recorded but not open holds.

---

## 20. HTTP API — complete reference

Public URL rewrites (same handlers):
- `/v1/*` → `/api/v1/*`
- `/gateway/v1/*` → `/api/gateway/v1/*`
- `/v1beta/*` → `/api/v1beta/*`

### Public

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/api/v1/health` | None |

### Auth

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/api/v1/auth/nonce` | Same-origin |
| POST | `/api/v1/auth/verify` | Same-origin |
| GET | `/api/v1/auth/session` | Session |
| POST | `/api/v1/auth/logout` | Session |

### Wallet & balances

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/api/v1/wallet` | Session |

### Swaps & claims

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/api/v1/swaps/chains` | Session |
| GET | `/api/v1/swaps/tokens` | Session |
| POST | `/api/v1/swaps/quote` | Session + EVM |
| POST | `/api/v1/swaps/changenow/create` | Session + EVM — opens a **desk pay-in** route |
| POST | `/api/v1/swaps/settle` | Session |
| POST | `/api/v1/swaps/confirm` | Session + mock flag |
| POST | `/api/v1/swaps/scan` | Session |
| POST | `/api/v1/swaps/import` | Session |
| GET | `/api/v1/swaps/claims` | Session |
| POST | `/api/v1/swaps/claims/[id]/claim` | Session |

### Credit & redeem

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/api/v1/credits/convert` | Session |
| GET, POST | `/api/v1/redeem` | Session |
| GET | `/api/v1/redeem/[id]` | Session |
| POST | `/api/v1/redeem/[id]/confirm` | Session |
| GET | `/api/v1/virtual-keys` | Session |
| POST | `/api/v1/virtual-keys/[id]/revoke` | Session |

### Desk chat

| Method | Path | Auth |
| --- | --- | --- |
| GET, POST | `/api/v1/desk-chat` | Session |

### LLM gateway (virtual key)

| Method | Path | Auth |
| --- | --- | --- |
| GET | `/api/v1/models`, `/api/v1/models/[id]` | Virtual key |
| POST | `/api/v1/chat/completions` | Virtual key |
| POST | `/api/v1/messages` | Virtual key |
| GET, POST | `/api/v1beta/[[...path]]` | Virtual key (Gemini native) |
| * | `/api/gateway/v1/*` | Virtual key (alias) |

### Admin

| Method | Path | Auth |
| --- | --- | --- |
| GET, POST, DELETE | `/api/v1/admin/session` | Admin secret |
| GET | `/api/v1/admin/overview` | Admin |
| GET, POST | `/api/v1/admin/reward-rules` | Admin |
| GET | `/api/v1/admin/flags` | Admin |
| POST | `/api/v1/admin/flags/[id]/resolve` | Admin |
| GET | `/api/v1/admin/ledger` | Admin |
| GET | `/api/v1/admin/payouts` | Admin |
| POST | `/api/v1/admin/payouts/process` | Admin |

### Jobs

| Method | Path | Auth |
| --- | --- | --- |
| GET, POST | `/api/v1/jobs/payouts` | CRON_SECRET (POST also admin) |
| GET, POST | `/api/v1/jobs/settles` | CRON_SECRET (POST also admin) |

### Webhooks

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/api/v1/webhooks/lifi` | Swap-router settle webhook — `LIFI_WEBHOOK_SECRET` |
| POST | `/api/v1/webhooks/changenow` | Desk pay-in settle webhook — `CHANGENOW_WEBHOOK_SECRET` |

---

## 21. Operator console `/admin`

**Gate:** `ADMIN_SECRET` (min 16 chars)

**Login:** `POST /api/v1/admin/session` `{ "secret": "…" }` → admin cookie

**Header:** Accrued · Admin

| Page | What it shows / does |
| --- | --- |
| `/admin` Overview | Liability vs pools, open holds, held swaps, queued payouts, wallet count, open desk pay-ins |
| `/admin/rules` | Edit floor/bps/cap — creates new versioned `reward_rules` row; disable = kill switch |
| `/admin/flags` | Open wash holds — Release or Reject |
| `/admin/ledger` | Account totals + recent ledger rows + recent swaps |
| `/admin/payouts` | USDG outbox list; manual "Process queue" |
| `/admin/exchanges` | **Pay-in routes** — open desk pay-in exchange rows |

---

## 22. Background jobs and webhooks

### Cron (`vercel.json` — every minute)

| Job | Handler | Action |
| --- | --- | --- |
| Payouts | `POST /api/v1/jobs/payouts` | `processPayoutOutbox()` — treasury `payClaim`, max 8 attempts, exponential backoff, refund on hard failure |
| Settles | `POST /api/v1/jobs/settles` | `processPendingSettles()` — up to 20 pending swap-router / desk pay-in rows |

**Auth:** `Authorization: Bearer $CRON_SECRET`

**Local dev:** `src/instrumentation.ts` ticks both every 60s after 8s delay when `CRON_SECRET` set.

### Webhooks

- **Swap router webhook:** POST settle notification → upsert pending → run settle processor
- **Desk pay-in webhook:** same pattern

---

## 23. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Next.js 16 (Turbopack build)                                │
│  Pages: /, /login, /docs/*, /app/*, /admin/*                │
│  API: /api/v1/*, /api/gateway/v1/*                          │
│  Rewrites: /v1/*, /gateway/v1/*, /v1beta/*                  │
└────────────┬───────────────────────────────┬────────────────┘
             │                               │
      PostgreSQL / PGlite                  Redis
      Drizzle ORM                          Rate limits
      .data/t2c (local fallback)           Scan cache
             │
   ┌─────────┴─────────┐
   │ Integrations      │
   ├───────────────────┤
   │ Swap router       │ In-wallet quotes + fill status
   │ Desk pay-in       │ Robinhood ETH + fallback deposit routes
   │ Zerion API        │ 90-day wallet scan
   │ Vercel AI Gateway │ LLM upstream
   │ Robinhood RPC     │ USDG vault claims
   └───────────────────┘
```

**Single deployable:** one `npm run build` artifact serves UI + API.

**Key libraries:** wagmi/viem (EVM), siwe, tweetnacl (Solana), jose (JWT), zod (validation), framer-motion (UI).

---

## 24. Environment variables (complete)

### Required in production

| Variable | Purpose |
| --- | --- |
| `SESSION_SECRET` | JWT signing (32+ chars) |
| `APP_ORIGIN` | SIWE domain + CSRF origin |
| `DATABASE_URL` | Postgres (Neon or Docker) |
| `REDIS_URL` | Rate limits |
| `CRON_SECRET` | Job authorization (16+ chars) |

### Strongly recommended

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | OG tags, metadata |
| `AI_GATEWAY_API_KEY` | LLM upstream |
| `ADMIN_SECRET` | Operator console |
| `ZERION_API_KEY` | Wallet scan |
| `CHANGENOW_API_KEY` | Desk pay-in partner API (Robinhood ETH and fallback routes) |

### USDG / treasury

| Variable | Purpose |
| --- | --- |
| `TREASURY_ENABLED` | Allow treasury actions |
| `TREASURY_LIVE` | Production broadcast |
| `TREASURY_PRIVATE_KEY` | Signs vouchers (never commit) |
| `REWARD_VAULT_ADDRESS` | UsdgRewardVault address |

### Swap / webhooks

Internal env names map to the two renamed routes above:

| Variable | Purpose |
| --- | --- |
| `LIFI_API_KEY` | Optional swap-router partner key |
| `LIFI_WEBHOOK_SECRET` | Swap-router settle webhook auth |
| `CHANGENOW_WEBHOOK_SECRET` | Desk pay-in settle webhook auth |

### LLM fallbacks (if no Gateway)

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI fallback |
| `ANTHROPIC_API_KEY` | Anthropic fallback |
| `DEEPSEEK_API_KEY` | DeepSeek fallback |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | Google fallback |
| `XAI_API_KEY` | Grok fallback |
| `VERCEL_OIDC_TOKEN` | Auto on Vercel |

### Dev only

| Variable | Purpose |
| --- | --- |
| `ALLOW_MOCK_SWAPS` | Paper fills — **never on public prod** |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Optional WalletConnect |

### Docker compose (`.env.production.example`)

`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB=trade2credits`, `APP_PORT`

**Never commit:** `.env.local`, `.env.production`, treasury keys, vendor keys.

---

## 25. Security model

| Control | Implementation |
| --- | --- |
| Session auth | httpOnly JWT cookie |
| CSRF | Same-origin checks on POST |
| Rate limits | Redis-backed per route |
| Virtual keys | Hash-only storage; prefix display |
| Treasury key | Server-only; never in client bundle |
| Admin | Separate secret + cookie |
| Cron | Bearer secret |
| Webhooks | Shared HMAC secrets |
| Idempotency | Unique keys on convert/redeem |
| Wash holds | Manual review before credit |

---

## 26. Design and brand

| Token | Value |
| --- | --- |
| Product name | **Accrued** |
| Tagline | You swap. We credit. |
| Canvas | `#141416` |
| Raised | `#1c1c1f` |
| Accent | `#c23a3a` |
| Accent press | `#9f2f2f` |
| Fonts | Geist, Geist Mono |
| Virtual key prefix | `acc_` |

**UI patterns:** notched CTAs, corner bracket cards, mono tabular numbers, asymmetric hero, no purple/neon gradients.

**Component:** `src/components/brand/BrandMark.tsx` — used in header, login, docs, desk, admin, errors, footer.

**Constants:** `src/lib/brand.ts`

---

## 27. Local development

```bash
cp .env.example .env.local
# Edit SESSION_SECRET (32+ random chars)
npm install
npm run dev
```

Open **http://localhost:3000**

### Full stack

```bash
docker compose up --build
```

### Host Next + Docker data

```bash
docker compose up postgres redis
# DATABASE_URL=postgresql://t2c:t2c@localhost:5432/trade2credits
# REDIS_URL=redis://localhost:6379
npm run dev
```

### Useful scripts

| Command | Purpose |
| --- | --- |
| `npm run ci` | typecheck + 101 tests + build |
| `npm run test:live` | Live LLM gateway e2e (needs Gateway key) |
| `npm run deploy:reward-vault` | Deploy UsdgRewardVault |

---

## 28. Production, CI/CD, and health

### CI pipeline

```bash
npm ci
npm run ci
```

Equivalent to GitHub Actions: **typecheck → 101 tests → next build**

### Pre-deploy checklist

- [ ] `GET /api/v1/health` → `{ ok: true, database: true, redis: true }`
- [ ] `CRON_SECRET` set
- [ ] `APP_ORIGIN` matches public URL
- [ ] `ALLOW_MOCK_SWAPS` false or unset
- [ ] Treasury + vault if USDG live

### Health response

```json
{
  "ok": true,
  "database": true,
  "redis": true,
  "treasuryCanBroadcast": false,
  "rewardVaultConfigured": true,
  "cronConfigured": true,
  "adminConfigured": true
}
```

Returns **503** if DB or Redis (in production) unhealthy.

### Vercel

Push `main` → auto deploy. Set env vars in project dashboard. Cron in `vercel.json`.

### Docker production

```bash
cp .env.production.example .env.production
docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d
curl -fsS http://localhost:3000/api/v1/health
```

---

## 29. Test coverage

**101 tests** in CI (`vitest run`).

### Integration tests (behavioral)

| File | Covers |
| --- | --- |
| `ledger/ingest.integration.test.ts` | 50 bps credit; idempotent replay; sub-$250; LLM convert rejected |
| `ledger/convert.integration.test.ts` | Credit→USDG; partial; parallel serialization |
| `ledger/volume-reward.integration.test.ts` | Aggregate volume ≥$250 reward |
| `indexer/historical.integration.test.ts` | Scan; claim once; cooldown; Zerion cache |
| `fraud/phase4.integration.test.ts` | Wash A→B→A; hold; admin release/reject |
| `redeem/phase3.integration.test.ts` | LLM key mint; USDG queue; payout worker; $5 cap; cooldowns |
| `jobs/settles.integration.test.ts` | Pending swap-router fill → credited |
| `gateway/desk-chat.integration.test.ts` | Redeem before chat; usage charges |
| `gateway/live.e2e.test.ts` | Live provider probes (manual, needs Gateway key) |

### Unit tests

Rate limits, swap router, gateway catalog, swap-router + desk pay-in clients, treasury/vault, rules engine, security/origin, wallet dedupe, etc.

---

## 30. Repository map

```
src/
├── app/
│   ├── page.tsx              Landing
│   ├── login/                Wallet connect
│   ├── docs/                 14 doc pages
│   ├── app/                  Signed-in desk
│   ├── admin/                Operator console
│   └── api/v1/               REST API
├── components/
│   ├── brand/BrandMark.tsx   Accrued wordmark
│   ├── landing/              Hero, calculator, FAQ, etc.
│   ├── app/                  Desk UI
│   ├── docs/                 Docs shell
│   └── wallet-adapter/       Login UI
├── lib/
│   ├── brand.ts              Accrued constants
│   ├── db/schema.ts          Postgres schema
│   ├── ledger/               postSwapReward, convert, balances
│   ├── redeem/               USDG + LLM redeem
│   ├── gateway/              LLM proxy + catalog
│   ├── swap/                 Swap router + desk pay-in routing
│   ├── lifi/                 Swap router client (internal path name)
│   ├── changenow/            Desk pay-in client (internal path name)
│   ├── fraud/wash.ts         Wash detection
│   ├── rules/                Published terms engine
│   └── docs/catalog.ts       Docs index + search
contracts/UsdgRewardVault.sol
END-TO-END.md                 This file
E2E.md                        Shorter operator walk
README.md                     Quick start
```

---

## 31. Hands-on walkthrough (article script)

Use this 15-step script for a demo video or long-form article.

### Part A — Discover (5 min)

1. Open **`/`** — read hero headline and metrics strip
2. Drag **credit calculator** — $1,000 swap → $5.00 reward
3. Hover **Get started** — LLM logos peek; click → scrolls to How it pays
4. Browse **#api** — note five provider paths
5. Open **`/docs`** — search ⌘K "floor"; read How it pays

### Part B — Connect (2 min)

6. Click **Connect wallet** → **`/login`**
7. Connect MetaMask (or Phantom for Solana path)
8. Sign SIWE message — land on **`/app`**

### Part C — Earn credit (10 min)

9. **`/app/swap`** — quote Base→Robinhood (or your test pair); execute small qualifying fill **OR**
10. **`/app/claims`** — import a known qualifying tx hash; **Claim**

### Part D — Move credit (10 min)

11. **`/app`** — confirm website credit increased
12. **`/app/redeem`** — pick LLM, OpenAI, gpt-4o-mini, redeem $1+ — **copy `acc_` key once**

### Part E — Spend credit (5 min)

13. Terminal: curl `/v1/chat/completions` with key — check `X-Accrued-Remaining-Cents`
14. **`/app/chat`** — send a message; watch LLM balance drop

### Part F — Audit (3 min)

15. **`/app/rewards`** — show ledger rows; retry claim on same hash — no double pay

### Optional — USDG path (EVM only)

- Convert website credit → USDG rail on `/app`
- Redeem USDG on `/app/redeem` (respect $5 cap + 30-min cooldown)
- If treasury live: confirm on-chain claim; else show queued state

### Optional — Operator

- `/admin` — login with `ADMIN_SECRET`
- Review overview liability
- If wash hold exists: release or reject on `/admin/flags`

---

## 32. Article angles and talking points

1. **Wallet-native rewards** — the address is the account; no signup form
2. **Transparent published ratio** — 50 bps and a live calculator, not marketing fluff
3. **Two rails, one ledger** — USDG or LLM after the same swap pays
4. **`acc_` keys** — official OpenAI/Anthropic SDK, metered by desk credit
5. **No vendor keys in browser** — AI Gateway + virtual keys
6. **Robinhood USDG vault** — same-wallet constraint as a security feature
7. **Operator-grade** — kill switch, wash holds, immutable ledger
8. **Docs-first product** — `/docs` mirrors the live desk
9. **Single Next.js deploy** — marketing, desk, API, gateway in one build
10. **Qualifying volume floor** — anti-spam economics ($250 swap volume)

---

## 33. Glossary

| Term | Definition |
| --- | --- |
| **Accrued** | Public product name |
| **Website credit** | Reward on `user_credits` before rail convert |
| **Rail** | USDG (`user_usdt`) or LLM (`user_llm`) bucket |
| **Fill / swap** | On-chain trade row in `swaps` table |
| **Notional** | USD value of a fill |
| **BPS** | Basis points; 50 bps = 0.50% |
| **`acc_` key** | Virtual LLM API key minted at redeem |
| **SIWE / SIWS** | Sign-In with Ethereum / Solana |
| **Wash hold** | Round-trip swap flagged for review |
| **Outbox** | Queued USDG payouts awaiting treasury |
| **Gateway** | LLM proxy at `/v1/*` |
| **Desk** | Signed-in `/app` area |
| **Swap router** | In-wallet cross-chain fill path (API slug `lifi`) |
| **Desk pay-in** | Deposit-based fill path for Robinhood ETH and router fallbacks (API slug `changenow`) |
| **Pay-in routes** | Admin view of open desk pay-in exchanges |

---

## Related files

| File | Purpose |
| --- | --- |
| `README.md` | Quick start + config table |
| `E2E.md` | Shorter operator walk |
| `src/lib/docs/catalog.ts` | Docs search index |
| `src/lib/brand.ts` | Brand constants |
| `src/lib/rules/constants.ts` | Published numbers |

---

*Last updated: Accrued rebrand, hero CTAs, `/docs` site, `acc_` keys, BrandMark on all pages, 101-test CI.*
