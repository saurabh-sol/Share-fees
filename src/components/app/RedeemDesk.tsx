"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowSquareOut } from "@phosphor-icons/react";
import { DEFAULT_LLM_MODEL, DEFAULT_LLM_PROVIDER, isLlmProvider, type LlmProvider } from "@/lib/gateway/catalog";
import { MAX_USDG_REDEEM_CENTS } from "@/lib/redeem/limits";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotchedButton } from "@/components/ui/NotchedButton";
import { robinhoodAddressUrl, robinhoodTxUrl } from "@/lib/chains/robinhood";
import { submitUsdgRewardClaim } from "@/lib/redeem/browser";
import {
  redemptionClaimId,
  type OnChainClaimVoucher,
  type OnChainRewardClaim,
} from "@/lib/redeem/reward-vault-core";
import { LlmModelPicker, ProviderMark } from "./LlmModelPicker";
import { OpenAiKeyIssue } from "./OpenAiKeyIssue";
import { ApiKeyTryPanel } from "./ApiKeyTryPanel";

type Rail = "usdt" | "llm_credits";

type Redemption = {
  id: string;
  rail: string;
  amountCents: number;
  status: string;
  destination: string;
  createdAt: string | Date;
  txHash?: string | null;
};

type VirtualKey = {
  id: string;
  prefix: string;
  spendCapCents: number;
  spendUsedCents: number;
  remainingCents: number;
  provider?: string;
  model?: string;
  status: string;
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await response.json()) as T & { message?: string; error?: string };
  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "request_failed");
  }
  return data;
}

export function RedeemDesk({
  creditCents,
  usdtCents,
  llmCents,
  chainNamespace,
  gatewayBaseUrl,
  initialRedemptions,
  initialKeys,
  rewardVaultAddress,
  initialOnChainClaims,
}: {
  creditCents: number;
  usdtCents: number;
  llmCents: number;
  chainNamespace: "eip155" | "solana";
  gatewayBaseUrl: string;
  initialRedemptions: Redemption[];
  initialKeys: VirtualKey[];
  rewardVaultAddress: string | null;
  initialOnChainClaims: OnChainRewardClaim[];
}) {
  const router = useRouter();
  const evmOnly = chainNamespace === "eip155";
  const [rail, setRail] = useState<Rail>(evmOnly ? "usdt" : "llm_credits");
  const [provider, setProvider] = useState<LlmProvider>(DEFAULT_LLM_PROVIDER);
  const [model, setModel] = useState(DEFAULT_LLM_MODEL);
  const [amount, setAmount] = useState(() =>
    creditCents >= 100 ? (creditCents / 100).toFixed(2) : "1.00",
  );
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [issuedModel, setIssuedModel] = useState(DEFAULT_LLM_MODEL);
  const [issuedProvider, setIssuedProvider] = useState<LlmProvider>(DEFAULT_LLM_PROVIDER);
  const [redemptions, setRedemptions] = useState(initialRedemptions);
  const [keys, setKeys] = useState(initialKeys);
  const [onChainClaims, setOnChainClaims] = useState(initialOnChainClaims);
  const [balances, setBalances] = useState({ creditCents, usdtCents, llmCents });
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);

  const usdgMaxCents = MAX_USDG_REDEEM_CENTS;
  const available =
    balances.creditCents + (rail === "usdt" ? balances.usdtCents : balances.llmCents);
  const usdgClaimCap = Math.min(available, usdgMaxCents);

  async function refreshLists() {
    const [redeemData, keyData] = await Promise.all([
      readJson<{ redemptions: Redemption[] }>("/api/v1/redeem"),
      readJson<{ keys: VirtualKey[] }>("/api/v1/virtual-keys"),
    ]);
    setRedemptions(redeemData.redemptions);
    setKeys(keyData.keys);
  }

  async function onRedeem(event: React.FormEvent) {
    event.preventDefault();
    setStatus("working");
    setMessage(null);
    setClaimTxHash(null);
    setIssuedKey(null);
    try {
      const amountCents = Math.round(Number(amount) * 100);
      if (!Number.isFinite(amountCents) || amountCents < 100) {
        throw new Error("Minimum redeem is $1.00.");
      }
      if (rail === "usdt" && amountCents > usdgMaxCents) {
        throw new Error("USDG claims are capped at $5.00 per request.");
      }
      const result = await readJson<{
        alreadyExists: boolean;
        status: string;
        plaintextKey: string | null;
        creditCents: number;
        usdtCents: number;
        llmCents: number;
        redemptionId: string;
        onChainClaim: OnChainClaimVoucher | null;
      }>("/api/v1/redeem", {
        method: "POST",
        body: JSON.stringify({
          rail,
          amountCents,
          idempotencyKey: crypto.randomUUID(),
          ...(rail === "llm_credits" ? { provider, model } : {}),
        }),
      });
      setBalances({
        creditCents: result.creditCents,
        usdtCents: result.usdtCents,
        llmCents: result.llmCents,
      });
      if (result.plaintextKey) {
        setIssuedKey(result.plaintextKey);
        setIssuedModel(model);
        setIssuedProvider(provider);
      }
      await refreshLists();
      router.refresh();
      let onChainNote = "";
      if (rail === "usdt" && result.onChainClaim) {
        try {
          setClaimingId(result.redemptionId);
          const txHash = await submitUsdgRewardClaim(result.onChainClaim);
          await readJson(`/api/v1/redeem/${result.redemptionId}/confirm`, {
            method: "POST",
            body: JSON.stringify({ txHash }),
          });
          setOnChainClaims((prev) => [
            {
              claimId: redemptionClaimId(result.redemptionId),
              redemptionId: result.redemptionId,
              recipient: result.onChainClaim!.recipient,
              amountCents,
              claimedAt: Math.floor(Date.now() / 1000),
              txHash,
            },
            ...prev.filter((row) => row.redemptionId !== result.redemptionId),
          ]);
          await refreshLists();
          router.refresh();
          setClaimTxHash(txHash);
          onChainNote = ` On-chain claim ${txHash.slice(0, 10)}… is on Robinhood.`;
        } catch (error) {
          onChainNote =
            error instanceof Error
              ? ` Wallet claim did not land (${error.message}). The redeem is queued; treasury payClaim or retry from the list still writes the same on-chain claim.`
              : " Wallet claim did not land. The redeem is queued on-chain.";
        } finally {
          setClaimingId(null);
        }
      }
      setStatus("idle");
      setMessage(
        result.alreadyExists
          ? "That idempotency key already posted. The plaintext key is not shown again."
          : rail === "usdt"
            ? `Queued ${money(amountCents)} USDG to this wallet on Robinhood.${onChainNote || " It stays queued until the vault claim is submitted."}`
            : `Issued a ${money(amountCents)} ${provider} key for ${model}. Use the official ${provider} API. Cap is ${money(amountCents)}. Copy it now — it is not stored in plaintext.`,
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Redeem failed.");
    }
  }

  async function onSubmitQueuedClaim(redemptionId: string) {
    setStatus("working");
    setClaimingId(redemptionId);
    setMessage(null);
    setClaimTxHash(null);
    try {
      const detail = await readJson<{ onChainClaim: OnChainClaimVoucher | null }>(
        `/api/v1/redeem/${redemptionId}`,
      );
      const voucher = detail.onChainClaim;
      if (!voucher) {
        throw new Error("No on-chain voucher yet. Unlock treasury and the vault first.");
      }
      const txHash = await submitUsdgRewardClaim(voucher);
      await readJson(`/api/v1/redeem/${redemptionId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ txHash }),
      });
      setOnChainClaims((prev) => [
        {
          claimId: redemptionClaimId(redemptionId),
          redemptionId,
          recipient: voucher.recipient,
          amountCents:
            redemptions.find((row) => row.id === redemptionId)?.amountCents ?? 0,
          claimedAt: Math.floor(Date.now() / 1000),
          txHash,
        },
        ...prev.filter((row) => row.redemptionId !== redemptionId),
      ]);
      await refreshLists();
      router.refresh();
      setStatus("idle");
      setClaimTxHash(txHash);
      setMessage(`On-chain claim landed. ${txHash.slice(0, 10)}…`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "On-chain claim failed.");
    } finally {
      setClaimingId(null);
    }
  }

  async function onRevoke(id: string) {
    setStatus("working");
    setMessage(null);
    try {
      await readJson(`/api/v1/virtual-keys/${id}/revoke`, { method: "POST" });
      await refreshLists();
      router.refresh();
      setStatus("idle");
      setMessage("Key revoked. The gateway will reject it on the next request.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Revoke failed.");
    }
  }

  return (
    <div className="space-y-12">
      <dl className="grid grid-cols-1 divide-y divide-white/8 border-y border-white/8 md:grid-cols-3 md:divide-x md:divide-y-0">
        <div className="py-8 md:pr-8">
          <dt className="text-sm text-zinc-500">Total reward</dt>
          <dd className="mt-2 font-mono text-3xl tracking-tight text-zinc-100">
            {money(balances.creditCents)}
          </dd>
        </div>
        <div className="py-8 md:px-8">
          <dt className="text-sm text-zinc-500">USDG available</dt>
          <dd className="mt-2 font-mono text-3xl tracking-tight text-zinc-100">
            {money(balances.usdtCents)}
          </dd>
        </div>
        <div className="py-8 md:pl-8">
          <dt className="text-sm text-zinc-500">LLM credits available</dt>
          <dd className="mt-2 font-mono text-3xl tracking-tight text-zinc-100">
            {money(balances.llmCents)}
          </dd>
        </div>
      </dl>

      <form onSubmit={(event) => void onRedeem(event)} className="max-w-2xl space-y-6">
        <fieldset className="space-y-2">
          <legend className="text-sm text-zinc-400">Rail</legend>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-zinc-200">
              <input
                type="radio"
                name="redeem-rail"
                checked={rail === "usdt"}
                disabled={!evmOnly}
                onChange={() => {
                  setRail("usdt");
                  const cap = Math.min(
                    balances.creditCents + balances.usdtCents,
                    usdgMaxCents,
                  );
                  setAmount((Math.max(100, cap) / 100).toFixed(2));
                }}
              />
              USDG on Robinhood
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-200">
              <input
                type="radio"
                name="redeem-rail"
                checked={rail === "llm_credits"}
                onChange={() => setRail("llm_credits")}
              />
              LLM credits
            </label>
          </div>
          {!evmOnly ? (
            <p className="text-sm text-zinc-500">USDG withdraw is EVM-only. This session is Solana.</p>
          ) : null}
        </fieldset>

        {rail === "llm_credits" ? (
          <div className="space-y-3">
            <LlmModelPicker
              provider={provider}
              model={model}
              onChange={(next) => {
                setProvider(next.provider);
                setModel(next.model);
              }}
            />
            <p className="text-xs leading-relaxed text-zinc-500">
              Redeem $1.00 and this key can spend at most $1.00 on the official {provider} API. Extra
              tokens are rejected. After claim, redeem here to mint the key.
            </p>
          </div>
        ) : null}

        <label className="block space-y-2">
          <span className="text-sm text-zinc-400">Amount (USD)</span>
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full border border-white/10 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-accent"
          />
          <span className="block text-xs text-zinc-500">
            Redeemable now: {money(available)} (total reward + this rail). Minimum $1.00.
            {rail === "usdt"
              ? ` USDG claims cap at ${money(usdgMaxCents)} per request with a 30-minute cooldown per wallet and network.`
              : null}
          </span>
        </label>

        <NotchedButton
          type="submit"
          disabled={status === "working" || available < 100 || (rail === "usdt" && usdgClaimCap < 100)}
        >
          {status === "working" ? "Working…" : "Redeem"}
        </NotchedButton>
      </form>

      <OpenAiKeyIssue
        gatewayBaseUrl={gatewayBaseUrl}
        issuedKey={issuedKey}
        issuedModel={issuedKey ? issuedModel : model}
        issuedProvider={issuedKey ? issuedProvider : provider}
      />

      {issuedKey ? (
        <ApiKeyTryPanel
          gatewayBaseUrl={gatewayBaseUrl}
          initialProvider={issuedProvider}
          initialModel={issuedModel}
          initialApiKey={issuedKey}
          lockProviderModel
          title="Test it now"
          onSuccess={() => void refreshLists()}
        />
      ) : null}

      {message ? (
        status === "error" ? (
          <div role="alert" className="max-w-2xl border border-accent/40 px-5 py-4">
            <p className="text-sm text-zinc-100">Nothing was redeemed — your balances are unchanged.</p>
            <p className="mt-1 text-sm text-zinc-400">{message}</p>
          </div>
        ) : (
          <div className="max-w-2xl space-y-1" role="status">
            <p className="text-sm text-zinc-300">{message}</p>
            {claimTxHash ? (
              <a
                href={robinhoodTxUrl(claimTxHash)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs text-zinc-300 hover:text-zinc-50"
              >
                View transaction on Blockscout
                <ArrowSquareOut className="h-3.5 w-3.5" weight="regular" />
              </a>
            ) : null}
          </div>
        )
      ) : null}

      <section className="space-y-4">
        <h2 className="text-xl tracking-tight text-zinc-100">Virtual keys</h2>
        {keys.length === 0 ? (
          <EmptyState
            eyebrow="Virtual keys"
            title="No keys minted yet."
            body="Redeem LLM credits above and a capped acc_ key is issued instantly. Paste it into any OpenAI-compatible client; usage burns the credit."
          />
        ) : (
          <ul className="divide-y divide-white/8 border-y border-white/8">
            {keys.map((key) => (
              <li key={key.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <ProviderMark
                    provider={
                      key.provider && isLlmProvider(key.provider)
                        ? key.provider
                        : DEFAULT_LLM_PROVIDER
                    }
                    size={28}
                  />
                  <div>
                    <p className="font-mono text-sm text-zinc-100">{key.prefix}…</p>
                    <p className="font-mono text-xs text-zinc-500">
                      {money(key.remainingCents)} left of {money(key.spendCapCents)} · {key.provider ?? "openai"} ·{" "}
                      {key.model ?? "gpt-4o-mini"} · {key.status}
                    </p>
                  </div>
                </div>
                {key.status === "active" ? (
                  <div className="flex flex-wrap gap-2">
                    <NotchedButton
                      variant="ghost"
                      disabled={status === "working"}
                      onClick={() =>
                        setTestingKeyId((current) => (current === key.id ? null : key.id))
                      }
                    >
                      {testingKeyId === key.id ? "Close test" : "Test"}
                    </NotchedButton>
                    <NotchedButton
                      variant="ghost"
                      disabled={status === "working"}
                      onClick={() => void onRevoke(key.id)}
                    >
                      Revoke
                    </NotchedButton>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {testingKeyId ? (
          (() => {
            const key = keys.find((item) => item.id === testingKeyId);
            if (!key) return null;
            const keyProvider =
              key.provider && isLlmProvider(key.provider) ? key.provider : DEFAULT_LLM_PROVIDER;
            return (
              <ApiKeyTryPanel
                key={key.id}
                gatewayBaseUrl={gatewayBaseUrl}
                initialProvider={keyProvider}
                initialModel={key.model ?? DEFAULT_LLM_MODEL}
                lockProviderModel
                title={`Test ${key.prefix}…`}
                onSuccess={() => void refreshLists()}
              />
            );
          })()
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl tracking-tight text-zinc-100">Redemptions</h2>
        {redemptions.length === 0 ? (
          <EmptyState
            eyebrow="Redemptions"
            title="Nothing withdrawn yet."
            body="USDG redemptions become an on-chain claim on Robinhood. LLM redemptions land as keys above."
          />
        ) : (
          <ul className="divide-y divide-white/8 border-y border-white/8">
            {redemptions.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-mono text-sm text-zinc-100">
                    {row.rail === "usdt" ? "USDG" : "LLM"} · {money(row.amountCents)}
                  </p>
                  <p className="font-mono text-xs text-zinc-500">{row.id.slice(0, 18)}…</p>
                  {row.txHash ? (
                    <a
                      href={robinhoodTxUrl(row.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-zinc-300 hover:text-zinc-50"
                    >
                      On-chain {row.txHash.slice(0, 10)}…
                      <ArrowSquareOut className="h-3.5 w-3.5" weight="regular" />
                    </a>
                  ) : null}
                </div>
                <div className="flex flex-col items-start gap-2 md:items-end">
                  <p className="font-mono text-sm text-zinc-400">{row.status}</p>
                  {row.rail === "usdt" && row.status === "queued" && evmOnly ? (
                    rewardVaultAddress ? (
                      <NotchedButton
                        variant="ghost"
                        disabled={status === "working"}
                        onClick={() => void onSubmitQueuedClaim(row.id)}
                      >
                        {claimingId === row.id ? "Claiming…" : "Claim on-chain"}
                      </NotchedButton>
                    ) : (
                      <p className="max-w-[28ch] font-mono text-xs text-zinc-500">
                        Queued until UsdgRewardVault is set. No explorer link until the claim lands.
                      </p>
                    )
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl tracking-tight text-zinc-100">On-chain USDG claims</h2>
          {rewardVaultAddress ? (
            <a
              href={robinhoodAddressUrl(rewardVaultAddress)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-[0.14em] text-zinc-400 hover:text-zinc-200"
            >
              Vault on Blockscout
              <ArrowSquareOut className="h-3.5 w-3.5" weight="regular" />
            </a>
          ) : null}
        </div>
        {onChainClaims.length === 0 ? (
          <EmptyState
            eyebrow="Robinhood Chain"
            title="No USDG claims on-chain yet."
            body="Redeem USDG and submit the wallet claim. Each payout is stored on the vault so the same redemption cannot pay twice."
          />
        ) : (
          <ul className="divide-y divide-white/8 border-y border-white/8">
            {onChainClaims.map((claim) => (
              <li key={claim.claimId} className="flex items-center justify-between py-4">
                <div>
                  <p className="font-mono text-sm text-zinc-100">{money(claim.amountCents)} USDG</p>
                  <p className="font-mono text-xs text-zinc-500">
                    {claim.redemptionId.slice(0, 18)}…
                    {claim.claimedAt > 0
                      ? ` · ${new Date(claim.claimedAt * 1000).toLocaleString()}`
                      : null}
                  </p>
                  {claim.txHash ? (
                    <a
                      href={robinhoodTxUrl(claim.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-zinc-300 hover:text-zinc-50"
                    >
                      View on Blockscout {claim.txHash.slice(0, 10)}…
                      <ArrowSquareOut className="h-3.5 w-3.5" weight="regular" />
                    </a>
                  ) : rewardVaultAddress ? (
                    <a
                      href={robinhoodAddressUrl(rewardVaultAddress)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      {claim.claimId.slice(0, 10)}…
                      <ArrowSquareOut className="h-3.5 w-3.5" weight="regular" />
                    </a>
                  ) : (
                    <p className="mt-1 font-mono text-xs text-zinc-500">
                      {claim.claimId.slice(0, 10)}…
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
