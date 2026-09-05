import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { discoveredSwaps, swaps, walletScans } from "@/lib/db/schema";
import { getActiveRule } from "@/lib/rules/engine";
import type { HistoricalCandidate, TradeSource } from "./types";
import { zerionSource } from "./zerion";

export const SCAN_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
export const SCAN_COOLDOWN_MS = 5 * 60 * 1000;

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

  for (const candidate of candidates) {
    if (candidate.notionalUsdCents < minNotionalUsdCents) {
      skipped += 1;
      continue;
    }

    const [alreadyBooked] = await client
      .select({ id: swaps.id })
      .from(swaps)
      .where(and(eq(swaps.txHash, candidate.txHash), eq(swaps.fromChain, candidate.fromChain)))
      .limit(1);
    if (alreadyBooked) {
      skipped += 1;
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
        executedAt: candidate.executedAt,
        status: "unclaimed",
      });
      inserted += 1;
    } catch {
      skipped += 1;
    }
  }

  return { inserted, skipped };
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

  if (!input.force && last && Date.now() - last.scannedAt.getTime() < SCAN_COOLDOWN_MS) {
    throw new ScanError("scan_cooldown", 429);
  }

  const rule = await getActiveRule(client);
  const since = new Date(Date.now() - SCAN_WINDOW_MS);
  const candidates: HistoricalCandidate[] = [];
  const providers: string[] = [];

  for (const source of sources) {
    providers.push(source.name);
    const batch = await source.fetchTrades(input.address, since);
    candidates.push(...batch);
  }

  const result = await persistCandidates(input.userId, candidates, rule.minNotionalUsdCents, client);

  await client
    .insert(walletScans)
    .values({
      userId: input.userId,
      scannedAt: new Date(),
      provider: providers.join(",") || "none",
      foundCount: result.inserted,
    })
    .onConflictDoUpdate({
      target: walletScans.userId,
      set: {
        scannedAt: new Date(),
        provider: providers.join(",") || "none",
        foundCount: result.inserted,
      },
    });

  return {
    ...result,
    scanned: candidates.length,
    providers,
    minNotionalUsdCents: rule.minNotionalUsdCents,
    windowDays: 90,
  };
}
