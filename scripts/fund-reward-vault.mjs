/**
 * Fund the UsdgRewardVault with USDG.
 *
 * Usage:
 *   TREASURY_PRIVATE_KEY=0x... FUND_AMOUNT_USDG=100 node scripts/fund-reward-vault.mjs
 *
 * Or with .env.local loaded via dotenv:
 *   npx dotenv -e .env.local -- node scripts/fund-reward-vault.mjs
 */

import {
  createPublicClient,
  createWalletClient,
  defineChain,
  formatUnits,
  getAddress,
  http,
  isHex,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const ROBINHOOD_CHAIN_ID = 4663;
const ROBINHOOD_USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const DEFAULT_VAULT = "0x991FA150A5Cf1680d41137a38bEAa9Eaa0eBE1db";
const USDG_DECIMALS = 6;

const robinhoodChain = defineChain({
  id: ROBINHOOD_CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" },
  },
});

const vaultAbi = parseAbi([
  "function owner() view returns (address)",
  "function usdg() view returns (address)",
  "function usdgBalance() view returns (uint256)",
  "function fund(uint256 amount)",
]);

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

function readPrivateKey() {
  const raw = process.env.TREASURY_PRIVATE_KEY?.trim();
  if (!raw) throw new Error("Set TREASURY_PRIVATE_KEY.");
  const hex = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!isHex(hex) || hex.length !== 66) throw new Error("TREASURY_PRIVATE_KEY must be 32-byte hex.");
  return hex;
}

async function main() {
  const key = readPrivateKey();
  const account = privateKeyToAccount(key);
  const vault = getAddress(process.env.REWARD_VAULT_ADDRESS?.trim() || DEFAULT_VAULT);
  const usdg = getAddress(ROBINHOOD_USDG);

  const amountUsdg = Number(process.env.FUND_AMOUNT_USDG ?? "100");
  if (!amountUsdg || amountUsdg <= 0) throw new Error("Set FUND_AMOUNT_USDG (e.g. 100).");
  const fundUnits = BigInt(amountUsdg) * 10n ** BigInt(USDG_DECIMALS);

  const publicClient = createPublicClient({ chain: robinhoodChain, transport: http() });
  const wallet = createWalletClient({ account, chain: robinhoodChain, transport: http() });

  const [owner, walletBal, vaultBal, allowance, eth] = await Promise.all([
    publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "owner" }),
    publicClient.readContract({ address: usdg, abi: erc20Abi, functionName: "balanceOf", args: [account.address] }),
    publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "usdgBalance" }),
    publicClient.readContract({ address: usdg, abi: erc20Abi, functionName: "allowance", args: [account.address, vault] }),
    publicClient.getBalance({ address: account.address }),
  ]);

  console.log("─── Pre-flight ───");
  console.log("treasury       ", account.address);
  console.log("vault          ", vault);
  console.log("owner          ", owner);
  console.log("treasury ETH   ", formatUnits(eth, 18));
  console.log("treasury USDG  ", formatUnits(walletBal, USDG_DECIMALS));
  console.log("vault USDG     ", formatUnits(vaultBal, USDG_DECIMALS));
  console.log("allowance      ", formatUnits(allowance, USDG_DECIMALS));
  console.log("funding        ", `${amountUsdg} USDG (${fundUnits} units)`);
  console.log("");

  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error("This key is not the vault owner.");
  }
  if (eth === 0n) {
    throw new Error("Treasury has 0 ETH — send Robinhood ETH for gas first.");
  }
  if (walletBal < fundUnits) {
    throw new Error(`Treasury only has ${formatUnits(walletBal, USDG_DECIMALS)} USDG — need ${amountUsdg}.`);
  }

  // Step 1: Approve vault to spend USDG (if needed).
  if (allowance < fundUnits) {
    console.log("→ Approving vault to spend USDG…");
    const approveTx = await wallet.writeContract({
      address: usdg,
      abi: erc20Abi,
      functionName: "approve",
      args: [vault, fundUnits],
    });
    const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveTx });
    console.log("  approve tx:", approveTx);
    console.log("  status:    ", approveReceipt.status);
    if (approveReceipt.status !== "success") throw new Error("Approve failed.");
  } else {
    console.log("→ Allowance sufficient, skipping approve.");
  }

  // Step 2: Fund the vault.
  console.log("→ Calling fund()…");
  const fundTx = await wallet.writeContract({
    address: vault,
    abi: vaultAbi,
    functionName: "fund",
    args: [fundUnits],
  });
  const fundReceipt = await publicClient.waitForTransactionReceipt({ hash: fundTx });
  console.log("  fund tx:   ", fundTx);
  console.log("  status:    ", fundReceipt.status);
  console.log("  explorer:  ", `${robinhoodChain.blockExplorers.default.url}/tx/${fundTx}`);

  if (fundReceipt.status !== "success") throw new Error("Fund transaction failed.");

  // Step 3: Verify.
  const [walletAfter, vaultAfter] = await Promise.all([
    publicClient.readContract({ address: usdg, abi: erc20Abi, functionName: "balanceOf", args: [account.address] }),
    publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "usdgBalance" }),
  ]);

  console.log("");
  console.log("─── Done ───");
  console.log("treasury USDG  ", formatUnits(walletAfter, USDG_DECIMALS));
  console.log("vault USDG     ", formatUnits(vaultAfter, USDG_DECIMALS));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
