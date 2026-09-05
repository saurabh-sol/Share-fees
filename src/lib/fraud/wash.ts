export const WASH_WINDOW_MS = 60 * 60 * 1000;

export type WashLeg = {
  fromToken: string;
  toToken: string;
  fromChain: string;
  toChain: string;
  executedAt: Date;
};

export function normalizeAsset(value: string) {
  return value.trim().toLowerCase();
}

export function isRoundTripWash(current: WashLeg, prior: WashLeg) {
  const delta = Math.abs(current.executedAt.getTime() - prior.executedAt.getTime());
  if (delta > WASH_WINDOW_MS) return false;

  const currentFrom = normalizeAsset(current.fromToken);
  const currentTo = normalizeAsset(current.toToken);
  const priorFrom = normalizeAsset(prior.fromToken);
  const priorTo = normalizeAsset(prior.toToken);
  if (!currentFrom || !currentTo || currentFrom === currentTo) return false;
  if (currentFrom !== priorTo || currentTo !== priorFrom) return false;

  const currentFromChain = normalizeAsset(current.fromChain);
  const currentToChain = normalizeAsset(current.toChain);
  const priorFromChain = normalizeAsset(prior.fromChain);
  const priorToChain = normalizeAsset(prior.toChain);
  const sameChainBounce = currentFromChain === currentToChain && priorFromChain === priorToChain;
  const crossHopBack = currentFromChain === priorToChain && currentToChain === priorFromChain;
  return sameChainBounce || crossHopBack;
}

export function findWashPrior(current: WashLeg, recents: WashLeg[]) {
  return recents.find((prior) => isRoundTripWash(current, prior)) ?? null;
}
