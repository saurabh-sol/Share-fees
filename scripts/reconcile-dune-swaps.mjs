/**
 * Reconcile AccruedSwap on-chain events vs Blockscout and optional Postgres swaps table.
 *
 * Usage:
 *   node scripts/reconcile-dune-swaps.mjs
 *   node scripts/reconcile-dune-swaps.mjs 0xtx1 0xtx2 ...
 */
import { createPublicClient, decodeEventLog, http } from "viem";
import { defineChain } from "viem";

const ROUTER = (process.env.ACCRUED_SWAP_ROUTER_ADDRESS ?? "0xc78e883f87675e75334df4d341f6fcb0915ebf19").toLowerCase();

const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
});

const ACCRUED_SWAP_ABI = [
  {
    type: "event",
    name: "AccruedSwap",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "tokenIn", type: "address", indexed: true },
      { name: "tokenOut", type: "address", indexed: true },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false },
      { name: "recipient", type: "address", indexed: false },
    ],
  },
];

const client = createPublicClient({ chain: robinhood, transport: http() });

async function fetchRouterSwaps(fromBlock, toBlock) {
  const logs = await client.getLogs({
    address: ROUTER,
    fromBlock: BigInt(fromBlock),
    toBlock: BigInt(toBlock),
  });

  return logs.map((log) => {
    const decoded = decodeEventLog({
      abi: ACCRUED_SWAP_ABI,
      data: log.data,
      topics: log.topics,
    });
    return {
      txHash: log.transactionHash,
      logIndex: log.logIndex,
      user: decoded.args.user,
      tokenIn: decoded.args.tokenIn,
      tokenOut: decoded.args.tokenOut,
      amountIn: decoded.args.amountIn.toString(),
      amountOut: decoded.args.amountOut.toString(),
      blockNumber: log.blockNumber,
    };
  });
}

async function reconcileTx(txHash) {
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  const tx = await client.getTransaction({ hash: txHash });

  const events = receipt.logs
    .filter((l) => l.address.toLowerCase() === ROUTER)
    .map((log) =>
      decodeEventLog({ abi: ACCRUED_SWAP_ABI, data: log.data, topics: log.topics }),
    );

  console.log(`\n─── ${txHash} ───`);
  console.log("to:", tx.to, tx.to?.toLowerCase() === ROUTER ? "OK" : "NOT_ROUTER");
  console.log("from (trader):", tx.from);
  console.log("AccruedSwap events:", events.length);
  if (events.length !== 1) {
    console.log("WARN: expected exactly 1 AccruedSwap per user trade");
  }
  for (const e of events) {
    console.log("  user:", e.args.user);
    console.log("  tokenIn:", e.args.tokenIn, "amountIn:", e.args.amountIn.toString());
    console.log("  tokenOut:", e.args.tokenOut, "amountOut:", e.args.amountOut.toString());
    if (e.args.user.toLowerCase() === ROUTER) {
      console.log("FAIL: router counted as user");
    }
  }
}

async function main() {
  const manual = process.argv.slice(2);
  if (manual.length > 0) {
    for (const hash of manual) {
      await reconcileTx(hash);
    }
    return;
  }

  const latest = await client.getBlockNumber();
  const from = latest > 50_000n ? latest - 50_000n : 0n;
  console.log(`Scanning AccruedSwap logs ${from} → ${latest} on ${ROUTER}`);
  const swaps = await fetchRouterSwaps(from, latest);
  console.log(`Found ${swaps.length} AccruedSwap events`);

  const byTx = new Map();
  for (const s of swaps) {
    const key = s.txHash;
    byTx.set(key, (byTx.get(key) ?? 0) + 1);
  }
  const dupes = [...byTx.entries()].filter(([, n]) => n > 1);
  if (dupes.length) {
    console.log("WARN duplicate events in same tx:", dupes);
  } else {
    console.log("OK: no duplicate AccruedSwap rows per tx");
  }

  const routersAsUsers = swaps.filter((s) => s.user.toLowerCase() === ROUTER);
  if (routersAsUsers.length) {
    console.log("FAIL: router address appears as user");
  } else {
    console.log("OK: no router-as-user");
  }

  const sample = swaps.slice(0, Math.min(5, swaps.length));
  for (const s of sample) {
    await reconcileTx(s.txHash);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
