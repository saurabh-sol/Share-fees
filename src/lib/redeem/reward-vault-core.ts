import { getAddress, keccak256, parseAbi, stringToHex, type Hex } from "viem";
import { ROBINHOOD_CHAIN_ID } from "@/lib/chains/robinhood";

export const TREASURY_USDG_DECIMALS = 6;
export const USDG_CLAIM_DEADLINE_SECONDS = 7 * 24 * 60 * 60;

export const usdgRewardVaultAbi = parseAbi([
  "function payClaim(string redemptionId, address recipient, uint256 amount)",
  "function claim(string redemptionId, uint256 amount, uint256 deadline, bytes signature)",
  "function claimIdOf(string redemptionId) view returns (bytes32)",
  "function getClaim(bytes32 claimId) view returns (address recipient, uint256 amount, uint64 claimedAt, string redemptionId)",
  "function claimed(bytes32 claimId) view returns (bool)",
  "function recipientClaimCount(address recipient) view returns (uint256)",
  "function recipientClaimAt(address recipient, uint256 index) view returns (bytes32)",
  "function usdg() view returns (address)",
  "function operator() view returns (address)",
  "function usdgBalance() view returns (uint256)",
  "function owner() view returns (address)",
  "function fund(uint256 amount)",
  "function recover(address token, address to, uint256 amount)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
  "event RewardClaimed(bytes32 indexed claimId, address indexed recipient, uint256 amount, string redemptionId)",
]);

export const usdgClaimTypedDataTypes = {
  Claim: [
    { name: "redemptionId", type: "string" },
    { name: "recipient", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export type OnChainClaimVoucher = {
  vault: `0x${string}`;
  chainId: number;
  redemptionId: string;
  recipient: `0x${string}`;
  amount: string;
  deadline: number;
  signature: Hex;
};

export type OnChainRewardClaim = {
  claimId: Hex;
  redemptionId: string;
  recipient: `0x${string}`;
  amountCents: number;
  claimedAt: number;
  txHash: Hex | null;
};

export function redemptionClaimId(redemptionId: string): Hex {
  return keccak256(stringToHex(redemptionId));
}

export function centsToUsdgUnits(amountCents: number): bigint {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("invalid_usdg_cents");
  }
  return BigInt(amountCents) * 10n ** BigInt(TREASURY_USDG_DECIMALS - 2);
}

export function usdgUnitsToCents(units: bigint): number {
  const cents = units / 10n ** BigInt(TREASURY_USDG_DECIMALS - 2);
  return Number(cents);
}

export function usdgClaimEip712Domain(vault: `0x${string}`) {
  return {
    name: "UsdgRewardVault",
    version: "1",
    chainId: ROBINHOOD_CHAIN_ID,
    verifyingContract: vault,
  } as const;
}

export function buildPayClaimRequest(input: {
  vault: `0x${string}`;
  destination: string;
  amountCents: number;
  redemptionId: string;
}) {
  return {
    address: input.vault,
    abi: usdgRewardVaultAbi,
    functionName: "payClaim" as const,
    args: [
      input.redemptionId,
      getAddress(input.destination),
      centsToUsdgUnits(input.amountCents),
    ] as const,
  };
}
