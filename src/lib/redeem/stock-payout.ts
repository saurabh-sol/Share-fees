import { createPublicClient, createWalletClient, getAddress, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { robinhoodChain } from "@/lib/chains/robinhood";
import { env } from "@/lib/env";
import { stockOptionForRail } from "./stock-catalog";
import {
  assertStockInventoryForRedeem,
  centsToStockUnits,
  stockUsdCentsPerShare,
} from "./stock-inventory";
import { normalizeTreasuryPrivateKey } from "./treasury";

const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

export function stockTreasuryCanBroadcast() {
  const key = normalizeTreasuryPrivateKey(env.stockTreasuryPrivateKey ?? env.treasuryPrivateKey);
  if (!key) return false;
  if (env.nodeEnv === "production") {
    return env.treasuryEnabled && env.treasuryLive;
  }
  return !env.treasuryDisabled;
}

export async function broadcastStockPayout(input: {
  rail: string;
  destination: string;
  amountCents: number;
  redemptionId: string;
}) {
  const option = stockOptionForRail(input.rail);
  if (!option) throw new Error("invalid_stock_rail");

  const key = normalizeTreasuryPrivateKey(env.stockTreasuryPrivateKey ?? env.treasuryPrivateKey);
  if (!key) throw new Error("stock_treasury_disabled");

  await assertStockInventoryForRedeem(input.rail, input.amountCents);

  const account = privateKeyToAccount(key);
  const recipient = getAddress(input.destination);
  const amount = centsToStockUnits(input.amountCents, stockUsdCentsPerShare(option));

  const publicClient = createPublicClient({ chain: robinhoodChain, transport: http() });
  const wallet = createWalletClient({ account, chain: robinhoodChain, transport: http() });

  const hash = await wallet.writeContract({
    address: option.address,
    abi: erc20Abi,
    functionName: "transfer",
    args: [recipient, amount],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
  if (receipt.status !== "success") throw new Error("stock_transfer_reverted");
  return hash;
}
