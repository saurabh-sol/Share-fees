import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { discoveredSwaps, swaps, walletScans } from "@/lib/db/schema";
import { settleScannedVolumeReward } from "@/lib/ledger/volume-reward";
import { MIN_NOTIONAL_USD_CENTS, getActiveRuleOrNull } from "@/lib/rules/engine";
import { isClaimableKind, type HistoricalCandidate, type TradeSource } from "./types";
import { zerionSource } from "./zerion";

export const SCAN_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
export const SCAN_COOLDOWN_MS = 5 * 60 * 1000;

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
  const zerion = zerionSource();
  return zerion ? [zerion] : [];
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
        skipped += 1;
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

export async function scanWallet(input: {
  userId: string;
  address: string;
  sources?: TradeSource[];
  force?: boolean;
  db?: Awaited<ReturnType<typeof getDb>>;
}) {
  const client = input.db ?? (await getDb());
  const sources = input.sources ?? defaultTradeSources();
  const [last] = await client
    .select()
    .from(walletScans)
    .where(eq(walletScans.userId, input.userId))
    .limit(1);
  const lastScannedAt = asDate(last?.scannedAt);

  if (
    !input.force &&
    last &&
    last.foundCount > 0 &&
    lastScannedAt &&
    Date.now() - lastScannedAt.getTime() < SCAN_COOLDOWN_MS
  ) {
    const retryAfterSec = Math.ceil(
      (SCAN_COOLDOWN_MS - (Date.now() - lastScannedAt.getTime())) / 1000,
    );
    return {
      inserted: 0,
      skipped: 0,
      scanned: last.foundCount,
      providers: last.provider ? last.provider.split(",").filter(Boolean) : [],
      cooldown: true,
      retryAfterSec,
      minNotionalUsdCents: (await getActiveRuleOrNull(client))?.minNotionalUsdCents ?? MIN_NOTIONAL_USD_CENTS,
      windowDays: 90,
      volumeReward: await settleScannedVolumeReward(input.userId, client),
    };
  }

  const rule = await getActiveRuleOrNull(client);
  const since = new Date(Date.now() - SCAN_WINDOW_MS);
  const candidates: HistoricalCandidate[] = [];
  const providers: string[] = [];

  for (const source of sources) {
    providers.push(source.name);
    try {
      const batch = await source.fetchTrades(input.address, since);
      candidates.push(...batch);
    } catch (error) {
      const message = error instanceof Error ? error.message : "scan_source_failed";
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

  return {
    ...result,
    scanned: candidates.length,
    providers,
    minNotionalUsdCents: rule?.minNotionalUsdCents ?? MIN_NOTIONAL_USD_CENTS,
    windowDays: 90,
    volumeReward: await settleScannedVolumeReward(input.userId, client),
  };
}
