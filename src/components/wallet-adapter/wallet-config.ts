export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "signing"
  | "connected"
  | "error"
  | "rejected"
  | "unavailable";

export type DiscoveredWallet = {
  id: string;
  name: string;
  description: string;
  iconUrl: string | null;
  connectorUid: string | null;
  kind: "evm" | "solana";
  rdns?: string;
};
