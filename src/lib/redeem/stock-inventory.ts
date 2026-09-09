import { createPublicClient, formatUnits, http, parseAbi, parseUnits } from "viem";
import { robinhoodChain } from "@/lib/chains/robinhood";
import { env } from "@/lib/env";
import {
  DEFAULT_STOCK_INVENTORY_WALLET,
  DEMO_STOCK_SHARES,
  STOCK_PAYOUT_OPTIONS,
  type StockPayoutOption,
  type StockSymbol,
} from "./stock-catalog";

const erc20Abi = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

const client = createPublicClient({
  chain: robinhoodChain,
  transport: http(undefined, { timeout: 20_000 }),
});

export function stockInventoryWallet() {
  return (env.stockInventoryWallet ?? DEFAULT_STOCK_INVENTORY_WALLET).toLowerCase() as `0x${string}`;
}

export function stockUsdCentsPerShare(option: StockPayoutOption) {
  if (option.symbol === "NVDA") return env.nvdaUsdCents ?? option.usdCentsPerShare;
  if (option.symbol === "AAPL") return env.aaplUsdCents ?? option.usdCentsPerShare;
  return env.msftUsdCents ?? option.usdCentsPerShare;
}

export function centsToStockUnits(amountCents: number, usdCentsPerShare: number) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("invalid_stock_cents");
  }
  if (usdCentsPerShare <= 0) throw new Error("invalid_stock_price");
  return (BigInt(amountCents) * 10n ** 18n) / BigInt(usdCentsPerShare);
}

export function stockUnitsToHuman(units: bigint) {
  return formatUnits(units, 18);
}

function demoStockRaw(symbol: StockSymbol) {
  return parseUnits(DEMO_STOCK_SHARES[symbol], 18);
}

function effectiveStockBalance(symbol: StockSymbol, balanceRaw: bigint) {
  if (!env.stockDemoInventory) return balanceRaw;
  const demoRaw = demoStockRaw(symbol);
  return balanceRaw > demoRaw ? balanceRaw : demoRaw;
}

export async function readStockInventory(option: StockPayoutOption) {
  const wallet = stockInventoryWallet();
  const [balanceRaw, decimals] = await Promise.all([
    client.readContract({
      address: option.address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [wallet],
    }),
    client.readContract({
      address: option.address,
      abi: erc20Abi,
      functionName: "decimals",
    }).catch(() => 18),
  ]);
  const priceCents = stockUsdCentsPerShare(option);
  const onChainHuman = formatUnits(balanceRaw, decimals);
  const effectiveRaw = effectiveStockBalance(option.symbol, balanceRaw);
  const balanceHuman = formatUnits(effectiveRaw, decimals);
  const balanceUsdCents = Math.floor(Number(balanceHuman) * priceCents);
  const demoListed = env.stockDemoInventory && effectiveRaw > balanceRaw;
  return {
    symbol: option.symbol,
    rail: option.rail,
    address: option.address,
    name: option.name,
    logoURI: option.logoURI,
    wallet,
    balanceRaw: effectiveRaw.toString(),
    balanceHuman,
    balanceUsdCents,
    usdCentsPerShare: priceCents,
    onChainBalanceHuman: onChainHuman,
    demoListed,
  };
}

export async function listStockInventory() {
  return Promise.all(STOCK_PAYOUT_OPTIONS.map((option) => readStockInventory(option)));
}

export async function assertStockInventoryForRedeem(rail: string, amountCents: number) {
  const option = STOCK_PAYOUT_OPTIONS.find((item) => item.rail === rail);
  if (!option) throw new Error("invalid_stock_rail");
  const row = await readStockInventory(option);
  const needed = centsToStockUnits(amountCents, row.usdCentsPerShare);
  if (BigInt(row.balanceRaw) < needed) {
    throw new Error("stock_inventory_insufficient");
  }
  return row;
}
