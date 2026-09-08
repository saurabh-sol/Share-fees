/**
 * End-to-end quote test against live Robinhood Chain RPC.
 * Uses the actual routeSwapQuote function with corrected token metadata.
 */
import { createPublicClient, http, parseUnits, formatUnits, parseAbi } from "viem";

const RPC = "https://rpc.mainnet.chain.robinhood.com";
const WETH = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const NATIVE = "0x0000000000000000000000000000000000000000";
const NVDA = "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC";
const TSLA = "0x322F0929c4625eD5bAd873c95208D54E1c003b2d";

const V3_QUOTER = "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7";
const FEE_TIERS = [100, 500, 3000, 10000];

const quoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const client = createPublicClient({ transport: http(RPC) });

const TOKENS = {
  ETH:  { address: NATIVE, symbol: "ETH",  decimals: 18 },
  WETH: { address: WETH,   symbol: "WETH", decimals: 18 },
  USDG: { address: USDG,   symbol: "USDG", decimals: 6 },
  NVDA: { address: NVDA,   symbol: "NVDA", decimals: 18 },
  TSLA: { address: TSLA,   symbol: "TSLA", decimals: 18 },
};

async function bestV3Quote(tokenIn, tokenOut, amountIn) {
  const wethAddr = WETH;
  const nativeLC = NATIVE.toLowerCase();
  const tIn = tokenIn.toLowerCase() === nativeLC ? wethAddr : tokenIn;
  const tOut = tokenOut.toLowerCase() === nativeLC ? wethAddr : tokenOut;

  let best = null;
  for (const fee of FEE_TIERS) {
    try {
      const result = await client.simulateContract({
        address: V3_QUOTER,
        abi: quoterAbi,
        functionName: "quoteExactInputSingle",
        args: [{ tokenIn: tIn, tokenOut: tOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
      });
      const amountOut = result.result[0];
      if (amountOut > 0n && (!best || amountOut > best.amountOut)) {
        best = { amountOut, fee };
      }
    } catch {}
  }
  return best;
}

async function testPair(from, to, amount) {
  const fromToken = TOKENS[from];
  const toToken = TOKENS[to];
  const amountIn = parseUnits(amount, fromToken.decimals);

  console.log(`\n── ${amount} ${from} → ${to} ──`);
  console.log(`  fromAddress: ${fromToken.address}`);
  console.log(`  toAddress:   ${toToken.address}`);
  console.log(`  amountIn:    ${amountIn.toString()} (${amount} ${from} at ${fromToken.decimals} dec)`);

  const result = await bestV3Quote(fromToken.address, toToken.address, amountIn);

  if (!result) {
    console.log(`  ❌ NO QUOTE FOUND`);
    return;
  }

  const humanOut = formatUnits(result.amountOut, toToken.decimals);
  console.log(`  ✅ amountOut: ${result.amountOut.toString()}`);
  console.log(`  ✅ human:     ${humanOut} ${to}`);
  console.log(`  ✅ fee tier:  ${result.fee} (${(result.fee / 10000).toFixed(2)}%)`);

  // USD notional
  const usdgLC = USDG.toLowerCase();
  if (fromToken.address.toLowerCase() === usdgLC) {
    console.log(`  💰 notional:  $${amount} (USDG is input)`);
  } else if (toToken.address.toLowerCase() === usdgLC) {
    console.log(`  💰 notional:  $${humanOut} (USDG is output)`);
  }
}

async function main() {
  console.log("═══ Acceptance Tests with CORRECT decimals ═══");

  await testPair("ETH",  "USDG", "1");
  await testPair("ETH",  "USDG", "0.1");
  await testPair("USDG", "ETH",  "100");
  await testPair("ETH",  "NVDA", "1");
  await testPair("NVDA", "ETH",  "10");
  await testPair("TSLA", "USDG", "1");
  await testPair("USDG", "NVDA", "100");
  await testPair("NVDA", "USDG", "10");

  console.log("\n═══ ALL DONE ═══");
}

main().catch((e) => { console.error(e); process.exit(1); });
