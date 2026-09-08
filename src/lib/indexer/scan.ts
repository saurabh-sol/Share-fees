import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { discoveredSwaps, swaps, walletScans } from "@/lib/db/schema";
import {
  previewScannedVolumeReward,
  settleScannedVolumeReward,
} from "@/lib/ledger/volume-reward";
import { MIN_NOTIONAL_USD_CENTS, getActiveRuleOrNull } from "@/lib/rules/engine";
import { isClaimableKind, type HistoricalCandidate, type TradeSource } from "./types";
import { alchemySource } from "./alchemy";
import { robinhoodRpcSource } from "./robinhood-rpc";
import { zerionSource } from "./zerion";

export const SCAN_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
/** No wait between wallet scans — each click runs a live fetch. */
export const SCAN_COOLDOWN_MS = 0;

export function asDate(value: Date | string | number | null | undefined) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value == null) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export class ScanError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ScanError";
  }
}

function newId() {
  return `disc_${crypto.randomUUID()}`;
}

export function defaultTradeSources(): TradeSource[] {
  // Robinhood Chain RPC scanner first — it needs no API key and covers the
  // chain that Alchemy/Zerion don't index (all in-app + on-chain trades).
  const sources: TradeSource[] = [robinhoodRpcSource()];
  const alchemy = alchemySource();
  if (alchemy) sources.push(alchemy);
  const zerion = zerionSource();
  if (zerion) sources.push(zerion);
  return sources;
}

export async function persistCandidates(
  userId: string,
  candidates: HistoricalCandidate[],
  minNotionalUsdCents: number,
  db?: Awaited<ReturnType<typeof getDb>>,
) {
  const client = db ?? (await getDb());
  let inserted = 0;
  let skipped = 0;
  let updated = 0;

  for (const candidate of candidates) {
    const [alreadyBooked] = await client
      .select({ id: swaps.id })
      .from(swaps)
      .where(and(eq(swaps.txHash, candidate.txHash), eq(swaps.fromChain, candidate.fromChain)))
      .limit(1);

    const qualifies =
      !alreadyBooked &&
      isClaimableKind(candidate.kind) &&
      candidate.notionalUsdCents >= minNotionalUsdCents;
    const status = alreadyBooked ? "booked" : qualifies ? "unclaimed" : "below_threshold";

    const [existing] = await client
      .select()
      .from(discoveredSwaps)
      .where(
        and(eq(discoveredSwaps.txHash, candidate.txHash), eq(discoveredSwaps.fromChain, candidate.fromChain)),
      )
      .limit(1);

    if (existing) {
      if (
        existing.status === "claimed" ||
        existing.status === "booked" ||
        existing.status === "volume_settled"
      ) {
        // Refresh notional / kind so volume isn't stuck at $0 from an
        // earlier mis-priced or mis-classified scan. Never reopen status.
        if (
          candidate.notionalUsdCents !== existing.notionalUsdCents ||
          candidate.kind !== existing.kind ||
          candidate.fromToken !== existing.fromToken ||
          candidate.toToken !== existing.toToken
        ) {
          await client
            .update(discoveredSwaps)
            .set({
              fromToken: candidate.fromToken,
              toToken: candidate.toToken,
              fromAmount: candidate.fromAmount,
              toAmount: candidate.toAmount,
              notionalUsdCents: candidate.notionalUsdCents,
              kind: candidate.kind,
              executedAt: candidate.executedAt,
            })
            .where(eq(discoveredSwaps.id, existing.id));
          updated += 1;
        } else {
          skipped += 1;
        }
        continue;
      }
      await client
        .update(discoveredSwaps)
        .set({
          toChain: candidate.toChain,
          fromToken: candidate.fromToken,
          toToken: candidate.toToken,
          fromAmount: candidate.fromAmount,
          toAmount: candidate.toAmount,
          notionalUsdCents: candidate.notionalUsdCents,
          kind: candidate.kind,
          executedAt: candidate.executedAt,
          status,
        })
        .where(eq(discoveredSwaps.id, existing.id));
      updated += 1;
      continue;
    }

    try {
      await client.insert(discoveredSwaps).values({
        id: newId(),
        userId,
        provider: candidate.provider,
        txHash: candidate.txHash,
        fromChain: candidate.fromChain,
        toChain: candidate.toChain,
        fromToken: candidate.fromToken,
        toToken: candidate.toToken,
        fromAmount: candidate.fromAmount,
        toAmount: candidate.toAmount,
        notionalUsdCents: candidate.notionalUsdCents,
        kind: candidate.kind,
        executedAt: candidate.executedAt,
        status,
      });
      inserted += 1;
    } catch {
      skipped += 1;
    }
  }

  return { inserted, skipped, updated };
}

export type WalletScanResult = {
  inserted: number;
  skipped: number;
  updated?: number;
  scanned: number;
  providers: string[];
  cooldown?: boolean;
  cached?: boolean;
  retryAfterSec?: number;
  minNotionalUsdCents: number;
  windowDays: number;
  volumeReward: Awaited<ReturnType<typeof previewScannedVolumeReward>>;
};

export async function scanWallet(input: {
  userId: string;
  address: string;
  sources?: TradeSource[];
  force?: boolean;
  db?: Awaited<ReturnType<typeof getDb>>;
}): Promise<WalletScanResult> {
  const client = input.db ?? (await getDb());
  const sources = input.sources ?? defaultTradeSources();
  const [last] = await client
    .select()
    .from(walletScans)
    .where(eq(walletScans.userId, input.userId))
    .limit(1);
  const lastScannedAt = asDate(last?.scannedAt);

  const cachedScan = async (retryAfterSec: number, cached: boolean) => ({
    inserted: 0,
    skipped: 0,
    scanned: last?.foundCount ?? 0,
    providers: last?.provider ? last.provider.split(",").filter(Boolean) : [],
    cooldown: true,
    cached,
    retryAfterSec,
    minNotionalUsdCents: (await getActiveRuleOrNull(client))?.minNotionalUsdCents ?? MIN_NOTIONAL_USD_CENTS,
    windowDays: 90,
    volumeReward: await previewScannedVolumeReward(input.userId, client),
  });

  if (
    SCAN_COOLDOWN_MS > 0 &&
    !input.force &&
    last &&
    lastScannedAt &&
    Date.now() - lastScannedAt.getTime() < SCAN_COOLDOWN_MS
  ) {
    const retryAfterSec = Math.ceil(
      (SCAN_COOLDOWN_MS - (Date.now() - lastScannedAt.getTime())) / 1000,
    );
    return cachedScan(retryAfterSec, false);
  }

  const rule = await getActiveRuleOrNull(client);
  const since = new Date(Date.now() - SCAN_WINDOW_MS);
  const candidates: HistoricalCandidate[] = [];
  const providers: string[] = [];

  let primarySucceeded = false;

  for (const source of sources) {
    if (primarySucceeded && source.name === "zerion") {
      providers.push("zerion(skipped)");
      continue;
    }
    providers.push(source.name);
    try {
      const batch = await source.fetchTrades(input.address, since);
      candidates.push(...batch);
      if (source.name === "alchemy" && batch.length >= 0) {
        primarySucceeded = true;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "scan_source_failed";
      if (source.name === "robinhood") {
        console.warn("[scan] Robinhood RPC scan failed, continuing with other sources:", message);
        continue;
      }
      if (source.name === "alchemy") {
        console.warn("[scan] Alchemy failed, falling back to Zerion:", message);
        continue;
      }
      if (last && (message.startsWith("zerion_429") || message === "rate_limited")) {
        return cachedScan(60, true);
      }
      throw new ScanError(message, 502);
    }
  }

  const result = await persistCandidates(
    input.userId,
    candidates,
    rule?.minNotionalUsdCents ?? MIN_NOTIONAL_USD_CENTS,
    client,
  );

  await client
    .insert(walletScans)
    .values({
      userId: input.userId,
      scannedAt: new Date(),
      provider: providers.join(",") || "none",
      foundCount: candidates.length,
    })
    .onConflictDoUpdate({
      target: walletScans.userId,
      set: {
        scannedAt: new Date(),
        provider: providers.join(",") || "none",
        foundCount: candidates.length,
      },
    });

  // Auto-settle qualifying volume so the user earns credit and
  // appears in the public desk stats immediately after scanning.
  let volumeReward = await previewScannedVolumeReward(input.userId, client);
  if (
    volumeReward.estimatedTotalRewardCents > 0 &&
    !volumeReward.alreadyExists
  ) {
    try {
      volumeReward = await settleScannedVolumeReward(input.userId, client);
    } catch {
      // Non-fatal: the user can still claim manually from the Activity page.
    }
  }

  return {
    ...result,
    scanned: candidates.length,
    providers,
    minNotionalUsdCents: rule?.minNotionalUsdCents ?? MIN_NOTIONAL_USD_CENTS,
    windowDays: 90,
    volumeReward,
  };
}
