/**
 * recover-vault.mjs — Recover ALL USDG from the UsdgRewardVault back to the owner.
 *
 * Usage:
 *   TREASURY_PRIVATE_KEY=0x... node scripts/recover-vault.mjs
 *
 * The `recover(token, to, amount)` function on the vault can only be called
 * by the contract owner. It sends the specified amount of any ERC-20 back to
 * the `to` address.
 */

import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const VAULT  = "0x991FA150A5Cf1680d41137a38bEAa9Eaa0eBE1db";
const USDG   = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const RPC    = "https://rpc.mainnet.chain.robinhood.com";
const CHAIN  = { id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };

const vaultAbi = parseAbi([
  "function owner() view returns (address)",
  "function usdgBalance() view returns (uint256)",
  "function recover(address token, address to, uint256 amount)",
]);

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

const pk = process.env.TREASURY_PRIVATE_KEY;
if (!pk) { console.error("Set TREASURY_PRIVATE_KEY env var."); process.exit(1); }

const account = privateKeyToAccount(pk);
const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC) });
const walletClient = createWalletClient({ account, chain: CHAIN, transport: http(RPC) });

console.log("Wallet:", account.address);

// Read vault state
const owner = await publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName: "owner" });
console.log("Vault owner:", owner);

if (owner.toLowerCase() !== account.address.toLowerCase()) {
  console.error("❌ Your wallet is NOT the vault owner. Cannot recover.");
  process.exit(1);
}

const balance = await publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName: "usdgBalance" });
const decimals = await publicClient.readContract({ address: USDG, abi: erc20Abi, functionName: "decimals" });
const human = Number(balance) / 10 ** Number(decimals);

console.log(`Vault USDG balance: ${balance} (${human.toFixed(2)} USDG)`);

if (balance === 0n) {
  console.log("Vault is empty. Nothing to recover.");
  process.exit(0);
}

console.log(`Recovering ${human.toFixed(2)} USDG to ${account.address}...`);

const hash = await walletClient.writeContract({
  address: VAULT,
  abi: vaultAbi,
  functionName: "recover",
  args: [USDG, account.address, balance],
});

console.log("Tx hash:", hash);
console.log("Waiting for confirmation...");

const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
console.log("✅ Recovery confirmed! Block:", receipt.blockNumber.toString());

const newBalance = await publicClient.readContract({ address: VAULT, abi: vaultAbi, functionName: "usdgBalance" });
console.log("Vault USDG balance after recovery:", newBalance.toString());
