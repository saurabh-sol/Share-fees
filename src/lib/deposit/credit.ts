import { env } from "@/lib/env";

export function depositMinUsdCents(): number {
  return env.depositMinUsdCents;
}

export function computeDisplayCreditCents(usdCents: number): number {
  return Math.round(usdCents * env.depositDisplayMultiplier);
}

export function computeGrantedLlmCents(usdCents: number): number {
  return Math.round((usdCents * env.depositGrantBps) / 10_000);
}
