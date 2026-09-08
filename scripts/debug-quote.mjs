/**
 * Debug Uniswap quoting on Robinhood Chain.
 * Probes V3 Factory pools, V3 QuoterV2, and V4 Quoter directly.
 */
import { createPublicClient, http, parseUnits, formatUnits, parseAbi } from "viem";

const RPC = "https://rpc.mainnet.chain.robinhood.com";

const WETH   = "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73";
const USDG   = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const NATIVE = "0x0000000000000000000000000000000000000000";
const NVDA   = "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC";
const TSLA   = "0x322F0929c4625eD5bAd873c95208D54E1c003b2d";

const V3_FACTORY = "0x1f7d7550b1b028f7571e69a784071f0205fd2efa";
const V3_QUOTER  = "0x33e885ed0ec9bf04ecfb19341582aadcb4c8a9e7";
const V4_QUOTER  = "0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94";

const FEE_TIERS = [100, 500, 3000, 10000];

const factoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
]);

const quoterV3Abi = parseAbi([
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
]);

const poolAbi = parseAbi([
  "function liquidity() view returns (uint128)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
]);

const erc20Abi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
]);

const client = createPublicClient({ transport: http(RPC) });

async function tokenInfo(addr) {
  try {
    const [sym, dec] = await Promise.all([
      client.readContract({ address: addr, abi: erc20Abi, functionName: "symbol" }),
      client.readContract({ address: addr, abi: erc20Abi, functionName: "decimals" }),
    ]);
    return { symbol: sym, decimals: Number(dec) };
  } catch (e) {
    return { symbol: "???", decimals: 18 };
  }
}

async function probeV3Factory(tokenA, tokenB, label) {
  console.log(`\n═══ V3 Factory: ${label} ═══`);
  console.log(`  tokenA: ${tokenA}`);
  console.log(`  tokenB: ${tokenB}`);
  
  for (const fee of FEE_TIERS) {
    try {
      const pool = await client.readContract({
        address: V3_FACTORY,
        abi: factoryAbi,
        functionName: "getPool",
        args: [tokenA, tokenB, fee],
      });
      const isZero = pool === "0x0000000000000000000000000000000000000000";
      if (isZero) {
        console.log(`  fee ${fee}: NO POOL`);
      } else {
        console.log(`  fee ${fee}: POOL ${pool}`);
        try {
          const liq = await client.readContract({ address: pool, abi: poolAbi, functionName: "liquidity" });
          const slot = await client.readContract({ address: pool, abi: poolAbi, functionName: "slot0" });
          console.log(`    liquidity: ${liq.toString()}`);
          console.log(`    sqrtPriceX96: ${slot[0].toString()}`);
          console.log(`    tick: ${slot[1]}`);
          console.log(`    unlocked: ${slot[6]}`);
        } catch (e) {
          console.log(`    pool read error: ${e.message?.slice(0, 120)}`);
        }
      }
    } catch (e) {
      console.log(`  fee ${fee}: FACTORY ERROR: ${e.message?.slice(0, 120)}`);
    }
  }
}

async function probeV3Quote(tokenIn, tokenOut, amountIn, decimalsIn, label) {
  console.log(`\n═══ V3 QuoterV2: ${label} ═══`);
  console.log(`  tokenIn:  ${tokenIn}`);
  console.log(`  tokenOut: ${tokenOut}`);
  console.log(`  amountIn: ${amountIn.toString()} (${formatUnits(amountIn, decimalsIn)} human)`);

  for (const fee of FEE_TIERS) {
    try {
      const result = await client.simulateContract({
        address: V3_QUOTER,
        abi: quoterV3Abi,
        functionName: "quoteExactInputSingle",
        args: [{
          tokenIn,
          tokenOut,
          amountIn,
          fee,
          sqrtPriceLimitX96: 0n,
        }],
      });
      const amountOut = result.result[0];
      console.log(`  fee ${fee}: amountOut = ${amountOut.toString()}`);
    } catch (e) {
      const msg = e.message || String(e);
      const short = msg.includes("revert") ? msg.slice(0, 200) : msg.slice(0, 200);
      console.log(`  fee ${fee}: REVERT: ${short}`);
    }
  }
}

async function probeV4Quote(tokenIn, tokenOut, amountIn, decimalsIn, label) {
  console.log(`\n═══ V4 Quoter: ${label} ═══`);
  console.log(`  tokenIn:  ${tokenIn}`);
  console.log(`  tokenOut: ${tokenOut}`);
  console.log(`  amountIn: ${amountIn.toString()}`);

  const V4_CONFIGS = [
    { fee: 3000, tickSpacing: 60 },
    { fee: 500, tickSpacing: 10 },
    { fee: 2500, tickSpacing: 25 },
    { fee: 2500, tickSpacing: 60 },
    { fee: 10000, tickSpacing: 200 },
    { fee: 100, tickSpacing: 1 },
  ];

  const a = BigInt(tokenIn);
  const b = BigInt(tokenOut);
  const currency0 = a < b ? tokenIn : tokenOut;
  const currency1 = a < b ? tokenOut : tokenIn;
  const zeroForOne = a < b;

  for (const cfg of V4_CONFIGS) {
    try {
      const sim = await client.simulateContract({
        address: V4_QUOTER,
        abi: [{
          inputs: [{ components: [
            { components: [
              { name: "currency0", type: "address" },
              { name: "currency1", type: "address" },
              { name: "fee", type: "uint24" },
              { name: "tickSpacing", type: "int24" },
              { name: "hooks", type: "address" },
            ], name: "poolKey", type: "tuple" },
            { name: "zeroForOne", type: "bool" },
            { name: "exactAmount", type: "uint128" },
            { name: "hookData", type: "bytes" },
          ], name: "params", type: "tuple" }],
          name: "quoteExactInputSingle",
          outputs: [
            { name: "deltaAmounts", type: "int128[]" },
            { name: "sqrtPriceX96After", type: "uint160" },
            { name: "initializedTicksCrossed", type: "uint32" },
          ],
          stateMutability: "nonpayable",
          type: "function",
        }],
        functionName: "quoteExactInputSingle",
        args: [{
          poolKey: {
            currency0,
            currency1,
            fee: cfg.fee,
            tickSpacing: cfg.tickSpacing,
            hooks: "0x0000000000000000000000000000000000000000",
          },
          zeroForOne,
          exactAmount: amountIn,
          hookData: "0x",
        }],
      });
      const deltas = sim.result[0];
      const outIdx = zeroForOne ? 1 : 0;
      let out = deltas[outIdx] ?? 0n;
      if (out < 0n) out = -out;
      console.log(`  fee ${cfg.fee}/ts ${cfg.tickSpacing}: deltas=[${deltas.map(String)}] → amountOut=${out.toString()}`);
    } catch (e) {
      const msg = (e.message || String(e)).slice(0, 150);
      console.log(`  fee ${cfg.fee}/ts ${cfg.tickSpacing}: REVERT: ${msg}`);
    }
  }
}

async function main() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║  Robinhood Chain Uniswap Debug Probe   ║");
  console.log("╚════════════════════════════════════════╝");

  const wethInfo = await tokenInfo(WETH);
  const usdgInfo = await tokenInfo(USDG);
  const nvdaInfo = await tokenInfo(NVDA);
  const tslaInfo = await tokenInfo(TSLA);

  console.log(`\nWETH: ${WETH} (${wethInfo.symbol}, ${wethInfo.decimals} dec)`);
  console.log(`USDG: ${USDG} (${usdgInfo.symbol}, ${usdgInfo.decimals} dec)`);
  console.log(`NVDA: ${NVDA} (${nvdaInfo.symbol}, ${nvdaInfo.decimals} dec)`);
  console.log(`TSLA: ${TSLA} (${tslaInfo.symbol}, ${tslaInfo.decimals} dec)`);

  // Check USDG decimals — critical for amount calculation
  console.log(`\n⚠ USDG decimals = ${usdgInfo.decimals} (expected 18 for Robinhood Token, 6 for stablecoin)`);

  const ethAmount = parseUnits("1", 18);           // 1 ETH
  const usdgAmount = parseUnits("1", usdgInfo.decimals); // 1 USDG
  const tslaAmount = parseUnits("1", tslaInfo.decimals);  // 1 TSLA

  // ── V3 Factory Pool Discovery ──
  await probeV3Factory(WETH, USDG, "WETH / USDG");
  await probeV3Factory(WETH, NVDA, "WETH / NVDA");
  await probeV3Factory(USDG, NVDA, "USDG / NVDA");
  await probeV3Factory(WETH, TSLA, "WETH / TSLA");
  await probeV3Factory(USDG, TSLA, "USDG / TSLA");

  // ── V3 Quoter Probes ──
  await probeV3Quote(WETH, USDG, ethAmount, 18, "1 WETH → USDG");
  await probeV3Quote(USDG, WETH, usdgAmount, usdgInfo.decimals, "1 USDG → WETH");
  await probeV3Quote(TSLA, USDG, tslaAmount, tslaInfo.decimals, "1 TSLA → USDG");
  await probeV3Quote(USDG, NVDA, usdgAmount, usdgInfo.decimals, "1 USDG → NVDA");

  // ── V4 Quoter Probes ──
  await probeV4Quote(NATIVE, USDG, ethAmount, 18, "1 ETH(native) → USDG");
  await probeV4Quote(WETH, USDG, ethAmount, 18, "1 WETH → USDG");
  await probeV4Quote(NATIVE, NVDA, ethAmount, 18, "1 ETH(native) → NVDA");
  await probeV4Quote(WETH, NVDA, ethAmount, 18, "1 WETH → NVDA");

  console.log("\n═══ DONE ═══");
}

main().catch((e) => { console.error(e); process.exit(1); });
