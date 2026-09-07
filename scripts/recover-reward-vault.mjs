/**
 * Recover USDG (or any ERC-20) from UsdgRewardVault back to the treasury.
 *
 * Replit:
 *   1. Secrets → TREASURY_PRIVATE_KEY = the owner key (no quotes)
 *   2. Shell:
 *        npm i viem
 *        node recover-reward-vault.mjs
 *
 * Local:
 *        TREASURY_PRIVATE_KEY=0x... node scripts/recover-reward-vault.mjs
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
  "function recover(address token, address to, uint256 amount)",
]);

const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

function readPrivateKey() {
  const raw = process.env.TREASURY_PRIVATE_KEY?.trim();
  if (!raw) {
    throw new Error("Set TREASURY_PRIVATE_KEY in Replit Secrets (or the environment).");
  }
  const hex = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!isHex(hex) || hex.length !== 66) {
    throw new Error("TREASURY_PRIVATE_KEY must be a 32-byte hex key.");
  }
  return hex;
}

async function main() {
  const key = readPrivateKey();
  const account = privateKeyToAccount(key);
  const vault = getAddress(process.env.REWARD_VAULT_ADDRESS?.trim() || DEFAULT_VAULT);
  const token = getAddress(process.env.RECOVER_TOKEN?.trim() || ROBINHOOD_USDG);
  const to = getAddress(process.env.RECOVER_TO?.trim() || account.address);

  const publicClient = createPublicClient({
    chain: robinhoodChain,
    transport: http(),
  });
  const wallet = createWalletClient({
    account,
    chain: robinhoodChain,
    transport: http(),
  });

  const [owner, vaultToken, vaultUsdg, tokenBal, decimals, symbol, eth] = await Promise.all([
    publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "owner" }),
    publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "usdg" }),
    publicClient.readContract({ address: vault, abi: vaultAbi, functionName: "usdgBalance" }),
    publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [vault],
    }),
    publicClient.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
    publicClient.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
    publicClient.getBalance({ address: account.address }),
  ]);

  const amount = tokenBal;
  console.log("treasury", account.address);
  console.log("vault", vault);
  console.log("owner", owner);
  console.log("recoverTo", to);
  console.log("token", token, symbol);
  console.log("vaultTokenConfigured", vaultToken);
  console.log("vaultUsdg()", formatUnits(vaultUsdg, 6));
  console.log("tokenBalanceOf(vault)", formatUnits(amount, decimals));
  console.log("treasuryEth", formatUnits(eth, 18));

  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error("This key is not the vault owner. Use TREASURY_PRIVATE_KEY.");
  }
  if (eth === 0n) {
    throw new Error("Treasury has 0 ETH. Send Robinhood ETH for gas first.");
  }
  if (amount === 0n) {
    throw new Error("Vault token balance is 0. Nothing to recover.");
  }

  const hash = await wallet.writeContract({
    address: vault,
    abi: vaultAbi,
    functionName: "recover",
    args: [token, to, amount],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const vaultAfter = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [vault],
  });
  const walletAfter = await publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [to],
  });

  console.log("tx", hash);
  console.log("explorer", `${robinhoodChain.blockExplorers.default.url}/tx/${hash}`);
  console.log("status", receipt.status);
  console.log("vaultAfter", formatUnits(vaultAfter, decimals));
  console.log("destinationAfter", formatUnits(walletAfter, decimals));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
