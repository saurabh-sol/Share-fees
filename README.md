# Accrued

**You swap. We credit.**

Accrued is a wallet-native rewards desk. Qualifying token swaps convert at a published ratio into website credit. That credit can be taken as **USDG** to the same wallet, or as **LLM credits** for Claude, OpenAI, DeepSeek, Google, and Grok-compatible clients.

User-facing walkthrough: [/docs](/docs). **Complete article-ready guide:** [END-TO-END.md](END-TO-END.md). Shorter operator notes: [E2E.md](E2E.md).

There is no email account and no username. The address that signs in is the desk. Ethereum wallets sign SIWE. Solana wallets sign SIWS. The session stays bound to that address.

## Published terms

| Term | Value |
| --- | --- |
| Floor | **$250 USD** confirmed **swap** volume before BPS is listed. Sends, receives, and approvals do not count. A single imported fill still has to be at or above $250 to claim on its own. |
| Ratio | **50 bps** (0.50%) of qualifying notional |
| Worked example | $1,842.60 notional × 50 bps = **$9.21** credit |
| Daily cap | **$2,500** of credit per day |
| USDG destination | Signed-in EVM address only, on **Robinhood Chain** |
| LLM credit | Metered `acc_` key, shown once |

Notional is the **USD value of the fill**, not the token amount. A $40 swap in a large-cap token is still $40. Changing the published rule later does not rewrite rows that already posted.

## How it pays

1. **Connect the wallet** at `/login`. MetaMask, Phantom, Coinbase, and other injected wallets are detected from the extension.
2. **Swap live, or bring history.** Swap Studio quotes and executes through the swap router or Robinhood ETH. Activity can scan the same wallet (last 90 days, when configured) or accept a verified transaction hash.
3. **Clear the $250 floor.** Confirmed swap volume on the connected wallet must reach $250 before BPS is listed. Smaller swaps still count toward that total. Sends do not. A live fill below $250 still executes; it does not pay on its own.
4. **Credit posts at 50 bps.** Qualifying notional × 0.50% becomes website credit.
5. **Claim, then convert.** Credit sits on the desk first. Convert 1:1 to the USDG rail or the LLM rail when you want it. USDG redeem is an on-chain vault claim on Robinhood. LLM redeem stays a `acc_` key.
6. **One hash, one credit.** The same transaction on the same chain never pays twice. Re-scan, retry, and a second claim on that fill do nothing.

Partners named on the site: MetaMask, Phantom, Coinbase, and Robinhood.

## The desk

| Page | Purpose |
| --- | --- |
| `/` | Landing: how it pays, the published ratio, both rails |
| `/login` | Connect wallet and sign in |
| `/app` | Balances for website credit, USDG rail, and LLM rail |
| `/app/swap` | Quote a pair, execute the fill, settle the credit |
| `/app/claims` | Scan wallet history or import a hash, then claim |
| `/app/redeem` | Convert credit and redeem USDG or a `acc_` key |

## Rails

### USDG

Pick the USDG rail before the credit is consumed. Redeem is **not paid** until `UsdgRewardVault` on **Robinhood Chain** stores the claim and transfers Robinhood USDG to the signed-in EVM address. The wallet can submit `claim()` with a desk signature, or treasury submits `payClaim()`. Either path writes the same on-chain record. A raw USDG `transfer` is not a reward claim. Gas is Robinhood ETH. The token is Robinhood USDG, not Paxos USDG on Ethereum mainnet. No other destination is accepted.

The redeem still books when the vault is unset. Locally a valid `TREASURY_PRIVATE_KEY` plus `REWARD_VAULT_ADDRESS` is enough to broadcast unless `TREASURY_ENABLED=false`. Production also needs `TREASURY_ENABLED=true` and `TREASURY_LIVE=true`. Until then, the desk shows the redeem as queued, not claimed on-chain.

Deploy the vault, fund it with USDG, then set the address:

```bash
npx tsx scripts/deploy-reward-vault.ts
```

### LLM credits

Pick the LLM rail, then redeem. The desk mints a `acc_` virtual key. The full key is shown **once**. After that, only a hash is stored.

The `acc_` key is the official provider key. Redeem locks the vendor. Usage burns desk points.

- OpenAI: `POST {origin}/v1/chat/completions` — official OpenAI SDK, `baseURL` `{origin}/v1`
- DeepSeek: same chat-completions path as `api.deepseek.com/v1`
- Anthropic: `POST {origin}/v1/messages` — official Anthropic SDK, `baseURL` `{origin}`, header `x-api-key`

```js
import OpenAI from "openai";
const client = new OpenAI({ apiKey: "acc_…", baseURL: "{origin}/v1" });
await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello" }],
});
```

Upstream calls go through **Vercel AI Gateway**. You do not paste OpenAI, Anthropic, or DeepSeek keys. Set `AI_GATEWAY_API_KEY`, or on Vercel use the automatic OIDC token. Desk credit still caps the `acc_` key. If Gateway is unset and a leftover provider key is also empty, that provider returns `503`. `/gateway/v1` is the same API.

## What the desk will not do

- Pay a fill below **$250 USD**.
- Credit the same transaction twice.
- Send USDG to any address other than the signed-in EVM wallet.
- Show a `acc_` key a second time.
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

## Production

The same Next.js app is the frontend and the API. Check it locally before a deploy:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

`GET /api/v1/health` must return `ok: true` with `database` and `redis` true. Production also requires `CRON_SECRET` so payout and settle jobs can run.

### Vercel

Push `main`. Set production env on the project: `SESSION_SECRET`, `APP_ORIGIN`, `NEXT_PUBLIC_APP_URL`, `DATABASE_URL`, `REDIS_URL`, `CRON_SECRET`, plus `AI_GATEWAY_API_KEY` (or rely on Vercel OIDC). `vercel.json` already ticks `/api/v1/jobs/payouts` and `/api/v1/jobs/settles` every minute.

### Docker

```bash
cp .env.production.example .env.production
# fill SESSION_SECRET, APP_ORIGIN, POSTGRES_PASSWORD, CRON_SECRET
docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d
curl -fsS http://localhost:3000/api/v1/health
```

Postgres and Redis stay on the Docker network. Only the app port is published. Paper fills are off. USDG claims stay queued until `TREASURY_ENABLED=true`, `TREASURY_LIVE=true`, `TREASURY_PRIVATE_KEY`, and `REWARD_VAULT_ADDRESS` are set.

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
| `LIFI_API_KEY` | Optional swap-router partner key. Public quotes still work without it. |
| `CHANGENOW_API_KEY` | Required to open a desk pay-in route. |
| `ZERION_API_KEY` | Shared 90-day wallet scan key. Calls are queued (2/sec) and a scan is reused for 15 minutes. Without it, users can still import a verified hash. |
| `AI_GATEWAY_API_KEY` | One Vercel AI Gateway key for OpenAI, Anthropic, and DeepSeek. On Vercel, `VERCEL_OIDC_TOKEN` is enough. |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY` / `GOOGLE_API_KEY` | Optional fallbacks if Gateway is unset. Virtual `acc_` keys never see these. |
| `TREASURY_ENABLED` / `TREASURY_LIVE` / `TREASURY_PRIVATE_KEY` | Signs Robinhood USDG claim vouchers and `payClaim`. Locally a valid key is enough unless `TREASURY_ENABLED=false`. Production also needs enabled + live. The private key stays server-only. |
| `REWARD_VAULT_ADDRESS` | Deployed `UsdgRewardVault` on Robinhood Chain. Required for live USDG claims. |
| `CRON_SECRET` | Authorizes the payout and settle jobs. Local `next dev` ticks them every minute. Vercel Cron uses the same secret. |
| `LIFI_WEBHOOK_SECRET` / `CHANGENOW_WEBHOOK_SECRET` | Shared secrets for swap-route settle webhooks. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Optional. WalletConnect stays hidden if empty. |

Do not put treasury or vendor keys in an image or a committed file.

LLM path: credit → redeem(provider) → `acc_` → official `/v1/chat/completions` → AI Gateway. After `AI_GATEWAY_API_KEY` or OIDC is set, `npx vitest run src/lib/gateway/live.e2e.test.ts` probes models, chat, and the 401 / 400 / 402 / 503 cases per provider.

## Operator console

`/admin` is secret-gated. After sign-in with `ADMIN_SECRET` it shows liability versus pools, the live reward rule (disable is a kill switch), held fills awaiting review, and the payout queue.

## Status

`GET /api/v1/health` reports whether the desk can reach its database and Redis, and whether treasury is allowed to broadcast.
