import { createPublicClient, formatUnits, http, parseAbi } from "viem";
import { ACCR_TOKEN_ADDRESS, robinhoodChain } from "@/lib/chains/robinhood";
import { HOLDER_MIN_TOKENS } from "./constants";

const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

const client = createPublicClient({
  chain: robinhoodChain,
  transport: http(undefined, { timeout: 20_000 }),
});

let decimalsCache: number | null = null;

async function accrDecimals() {
  if (decimalsCache != null) return decimalsCache;
  try {
    decimalsCache = await client.readContract({
      address: ACCR_TOKEN_ADDRESS as `0x${string}`,
      abi: erc20Abi,
      functionName: "decimals",
    });
  } catch {
    decimalsCache = 18;
  }
  return decimalsCache;
}

export function requiredBalanceRaw(decimals: number) {
  return BigInt(HOLDER_MIN_TOKENS) * 10n ** BigInt(decimals);
}

export async function readAccrBalance(walletAddress: string) {
  const address = walletAddress as `0x${string}`;
  const token = ACCR_TOKEN_ADDRESS as `0x${string}`;
  const decimals = await accrDecimals();
  const balanceRaw = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
  const requiredRaw = requiredBalanceRaw(decimals);
  const balanceHuman = formatUnits(balanceRaw, decimals);
  return {
    balanceRaw,
    balanceRawText: balanceRaw.toString(),
    balanceHuman,
    requiredRaw,
    requiredRawText: requiredRaw.toString(),
    meetsRequirement: balanceRaw >= requiredRaw,
    decimals,
  };
}
