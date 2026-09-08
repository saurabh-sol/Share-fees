/**
 * Pull ERC-20 balances out of the friend's StockPack-style vault
 * (0x752BAB…) back to the friend wallet.
 *
 * Those tokens were sent with token.transfer(), not deposit(). The vault's
 * emergencyWithdraw / withdrawExcess currently revert, so this script reports
 * each attempt. It cannot bypass a reverting contract.
 *
 * Env (from .env.local):
 *   FRIEND_PRIVATE_KEY or Freind-key
 *
 * Run:
 *   node --env-file=.env.local scripts/recover-friend-stocks.mjs
 */

import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, formatUnits, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
});

const STUCK_VAULT = "0x752BAb10472CaB5EBe6bA328A4147cA53eAe420c";

const TOKENS = [
  "0x2E8c31162b855A2ffa90F6F8634643Ad6F111e18",
  "0xe934e36A439C94017B64a3FecE66AF12099aBF50",
  "0x020bfC650A365f8BB26819deAAbF3E21291018b4",
  "0x57C0E45cB534413D1C20A4240955d6bB250BB4F1",
  "0xe8ffd7e24187F72afB08d75B1bb13088A989a791",
  "0xC9Ec05ED00de82629cdB1d6c3EA5D34f383A5396",
];

const vaultAbi = parseAbi([
  "function owner() view returns (address)",
  "function paused() view returns (bool)",
  "function inventory(address token) view returns (uint256)",
  "function liability(address token) view returns (uint256)",
  "function allowedTokens(address token) view returns (bool)",
  "function emergencyWithdraw(address token, uint256 amount, address to)",
  "function withdrawExcess(address token, uint256 amount, address to)",
  "function pause()",
  "function unpause()",
]);

const erc20Abi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
]);

function readFriendKey() {
  const env = process.env.FRIEND_PRIVATE_KEY?.trim() || process.env["Freind-key"]?.trim();
  if (env) return env.startsWith("0x") ? env : `0x${env}`;
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split("\n")) {
    if (line.startsWith("Freind-key") || line.startsWith("FRIEND_PRIVATE_KEY")) {
      const value = line.split("=", 2)[1]?.trim().replace(/^['"]|['"]$/g, "");
      if (value) return value.startsWith("0x") ? value : `0x${value}`;
    }
  }
  throw new Error("Set Freind-key or FRIEND_PRIVATE_KEY in .env.local");
}

async function main() {
  const account = privateKeyToAccount(readFriendKey());
  const publicClient = createPublicClient({ chain: robinhoodChain, transport: http() });
  const wallet = createWalletClient({ account, chain: robinhoodChain, transport: http() });
  const owner = await publicClient.readContract({
    address: STUCK_VAULT,
    abi: vaultAbi,
    functionName: "owner",
  });
  console.log("friend", account.address);
  console.log("vault", STUCK_VAULT);
  console.log("owner", owner);
  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error("Friend key is not the owner of 0x752BAB");
  }

  let recovered = 0;
  for (const token of TOKENS) {
    const [symbol, decimals, vaultBal, inventory, liability] = await Promise.all([
      publicClient.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
      publicClient.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
      publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [STUCK_VAULT] }),
      publicClient.readContract({ address: STUCK_VAULT, abi: vaultAbi, functionName: "inventory", args: [token] }),
      publicClient.readContract({ address: STUCK_VAULT, abi: vaultAbi, functionName: "liability", args: [token] }),
    ]);
    console.log(
      `${symbol} vault=${formatUnits(vaultBal, decimals)} inventory=${formatUnits(inventory, decimals)} liability=${formatUnits(liability, decimals)}`,
    );
    if (vaultBal === 0n) continue;

    for (const [fn, paused] of [
      ["withdrawExcess", false],
      ["emergencyWithdraw", true],
    ]) {
      let didPause = false;
      try {
        if (paused) {
          const hash = await wallet.writeContract({ address: STUCK_VAULT, abi: vaultAbi, functionName: "pause" });
          await publicClient.waitForTransactionReceipt({ hash });
          didPause = true;
        }
        await publicClient.simulateContract({
          account,
          address: STUCK_VAULT,
          abi: vaultAbi,
          functionName: fn,
          args: [token, vaultBal, account.address],
        });
        const hash = await wallet.writeContract({
          address: STUCK_VAULT,
          abi: vaultAbi,
          functionName: fn,
          args: [token, vaultBal, account.address],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`  ${fn} ${receipt.status} ${hash}`);
        if (receipt.status === "success") recovered += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
        console.log(`  ${fn} revert: ${message}`);
      } finally {
        if (didPause) {
          const hash = await wallet.writeContract({ address: STUCK_VAULT, abi: vaultAbi, functionName: "unpause" });
          await publicClient.waitForTransactionReceipt({ hash });
        }
      }
    }
  }
  console.log("recovered_ok", recovered);
  if (recovered === 0) {
    throw new Error(
      "Vault still refuses withdrawExcess/emergencyWithdraw. Need the 0x752BAB Solidity source (or a tx that previously succeeded) to use the signed-claim path.",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
