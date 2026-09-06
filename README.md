# Trade2Credits

**You swap. We credit.**

Trade2Credits is a wallet-native rewards desk. Qualifying token swaps convert at a published ratio into website credit. That credit can be taken as **USDG** to the same wallet, or as **LLM credits** for Claude, OpenAI, and DeepSeek-compatible clients.

There is no email account and no username. The address that signs in is the desk. Ethereum wallets sign SIWE. Solana wallets sign SIWS. The session stays bound to that address.

## Published terms

| Term | Value |
| --- | --- |
| Floor | **$250 USD** confirmed volume before BPS is listed; each paying fill must also be at or above $250 |
| Ratio | **50 bps** (0.50%) of qualifying notional |
| Worked example | $1,842.60 notional × 50 bps = **$9.21** credit |
| Daily cap | **$2,500** of credit per day |
| USDG destination | Signed-in EVM address only, on **Ethereum** |
| LLM credit | Metered `t2c_` key, shown once |

Notional is the **USD value of the fill**, not the token amount. A $40 swap in a large-cap token is still $40. Changing the published rule later does not rewrite rows that already posted.

## How it pays

1. **Connect the wallet** at `/login`. MetaMask, Phantom, Coinbase, and other injected wallets are detected from the extension.
2. **Swap live, or bring history.** Swap Studio quotes and executes through LI.FI, ChangeNOW, or Robinhood ETH. Activity can scan the same wallet (last 90 days, when a scan key is configured) or accept a verified transaction hash.
3. **Clear the $250 floor.** Confirmed volume on the connected wallet must reach $250 before BPS is listed. Smaller fills can still execute. They do not pay.
4. **Credit posts at 50 bps.** Qualifying notional × 0.50% becomes website credit.
5. **Claim, then convert.** Credit sits on the desk first. Convert 1:1 to the USDG rail or the LLM rail when you want it.
6. **One hash, one credit.** The same transaction on the same chain never pays twice. Re-scan, retry, and a second claim on that fill do nothing.

Partners named on the site: MetaMask, Phantom, Coinbase, LI.FI, ChangeNOW, and Robinhood.

## The desk

| Page | Purpose |
| --- | --- |
| `/` | Landing: how it pays, the published ratio, both rails |
| `/login` | Connect wallet and sign in |
| `/app` | Balances for website credit, USDG rail, and LLM rail |
| `/app/swap` | Quote a pair, execute the fill, settle the credit |
| `/app/claims` | Scan wallet history or import a hash, then claim |
| `/app/redeem` | Convert credit and redeem USDG or a `t2c_` key |

## Rails

### USDG

Pick the USDG rail before the credit is consumed. Redeem queues a payout to the **session EVM address on Ethereum**. No other destination is accepted.

The redeem still books when treasury is off. The transfer waits in queue until treasury is enabled, a signing key is present, and (in production) live send is turned on. Until then, the desk shows the redeem as queued, not broadcast.

### LLM credits

Pick the LLM rail, then redeem. The desk mints a `t2c_` virtual key. The full key is shown **once**. After that, only a hash is stored.

The `t2c_` key is the official provider key. Redeem locks the vendor. Usage burns desk points.

- OpenAI: `POST {origin}/v1/chat/completions` — official OpenAI SDK, `baseURL` `{origin}/v1`
- DeepSeek: same chat-completions path as `api.deepseek.com/v1`
- Anthropic: `POST {origin}/v1/messages` — official Anthropic SDK, `baseURL` `{origin}`, header `x-api-key`

```js
import OpenAI from "openai";
const client = new OpenAI({ apiKey: "t2c_…", baseURL: "{origin}/v1" });
await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello" }],
});
```

If a provider pool key is missing, redeem can still issue the virtual key; that provider returns an error until the pool is funded. `/gateway/v1` is the same API.

## What the desk will not do

- Pay a fill below **$250 USD**.
- Credit the same transaction twice.
- Send USDG to any address other than the signed-in EVM wallet.
- Show a `t2c_` key a second time.
- Invent a second balance. Website credit, USDG, and LLM are the same ledger, different rails.
- Treat a paper fill as a live chain swap. Practice rows exist only when `ALLOW_MOCK_SWAPS=true`, and that switch is rejected in production.

Round-trip wash (A → B → A on the same wallet inside an hour) still executes on-chain. The credit can be **held for review**. Release posts it. Reject does not.

## Open locally

```bash
cp .env.example .env.local
```

Set at least `SESSION_SECRET` to 32 or more random characters. Then:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), connect a wallet, and use the desk.

To run the site together with local Postgres, Redis, and the minute payout/settle jobs:

```bash
docker compose up --build
```

To keep Next.js on the machine and only run the data services:

```bash
docker compose up postgres redis
```

Point `.env.local` at `postgresql://t2c:t2c@localhost:5432/trade2credits` and `redis://localhost:6379`, then `npm run dev`.

## Configuration

Copy `.env.example` to `.env.local`. Keys the desk actually uses:

| Variable | Why it exists |
| --- | --- |
| `SESSION_SECRET` | Required to sign sessions. Use 32+ random characters. |
| `APP_ORIGIN` / `NEXT_PUBLIC_APP_URL` | Public origin for sign-in binding and the site URL. |
| `ALLOW_MOCK_SWAPS` | Practice fills on a local desk only. Never on a public host. |
| `ADMIN_SECRET` | Gates `/admin` and operator actions. |
| `DATABASE_URL` | Production and Docker Postgres. Empty locally uses an on-disk store. |
| `REDIS_URL` | Rate limits. Required in production. |
| `LIFI_API_KEY` | Optional partner key. Public quotes still work without it. |
| `CHANGENOW_API_KEY` | Required to open a ChangeNOW pay-in. |
| `ZERION_API_KEY` | Enables automatic 90-day wallet scans. Without it, users can still import a verified hash. |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY` | Pool keys for the LLM gateway. Paste into `.env.local` only, then restart the desk. Virtual `t2c_` keys never see these. Empty = `503 provider_pool_empty`. |
| `TREASURY_ENABLED` / `TREASURY_LIVE` / `TREASURY_PRIVATE_KEY` | All three are required before USDG is broadcast. The private key stays server-only. |
| `CRON_SECRET` | Authorizes the payout and settle jobs. |
| `LIFI_WEBHOOK_SECRET` / `CHANGENOW_WEBHOOK_SECRET` | Shared secrets for provider settle webhooks. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Optional. WalletConnect stays hidden if empty. |

Do not put treasury or vendor keys in an image or a committed file.

LLM path: credit → redeem(provider) → `t2c_` → official `/v1/chat/completions` → pool key. After the three pool keys are set, `npx vitest run src/lib/gateway/live.e2e.test.ts` probes models, chat, and the 401 / 400 / 402 / 503 cases per provider.

## Operator console

`/admin` is secret-gated. After sign-in with `ADMIN_SECRET` it shows liability versus pools, the live reward rule (disable is a kill switch), held fills awaiting review, and the payout queue.

## Status

`GET /api/v1/health` reports whether the desk can reach its database and Redis, and whether treasury is allowed to broadcast.
