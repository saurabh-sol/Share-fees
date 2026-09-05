import { claimDiscoveredSwap, listUnclaimed } from "./claim";
import { persistCandidates, scanWallet } from "./scan";

export class HistoricalIndexer {
  scanWallet = scanWallet;
  listUnclaimed = listUnclaimed;
  claimDiscoveredSwap = claimDiscoveredSwap;
  persistCandidates = persistCandidates;
}

export const historicalIndexer = new HistoricalIndexer();
