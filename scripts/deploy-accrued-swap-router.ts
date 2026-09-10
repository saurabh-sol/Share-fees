import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, http, isHex, type Abi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ROBINHOOD_WETH, robinhoodChain } from "../src/lib/chains/robinhood";
import { V3_SWAP_ROUTER_02 } from "../src/lib/uniswap/constants";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SWAP_ROUTER_02 = V3_SWAP_ROUTER_02[4663]!;

function readPrivateKey() {
  const raw = process.env.TREASURY_PRIVATE_KEY?.trim();
  if (!raw) {
    throw new Error("Set TREASURY_PRIVATE_KEY to deploy AccruedSwapRouter.");
  }
  const hex = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!isHex(hex) || hex.length !== 66) {
    throw new Error("TREASURY_PRIVATE_KEY must be a 32-byte hex key.");
  }
  return hex;
}

function compileRouter() {
  const source = readFileSync(join(root, "contracts/AccruedSwapRouter.sol"), "utf8");
  const input = JSON.stringify({
    language: "Solidity",
    sources: { "AccruedSwapRouter.sol": { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "shanghai",
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  });
  const compiled = spawnSync("npx", ["--yes", "solc@0.8.24", "--standard-json"], {
    input,
    encoding: "utf8",
    cwd: root,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (compiled.status !== 0) {
    throw new Error(compiled.stderr || compiled.stdout || "solc compile failed");
  }
  const jsonStart = compiled.stdout.indexOf("{");
  if (jsonStart < 0) {
    throw new Error(compiled.stderr || compiled.stdout || "solc did not emit JSON");
  }
  const parsed = JSON.parse(compiled.stdout.slice(jsonStart)) as {
    errors?: Array<{ severity: string; formattedMessage?: string; message?: string }>;
    contracts?: Record<string, Record<string, { abi: unknown[]; evm: { bytecode: { object: string } } }>>;
  };
  const fatal = parsed.errors?.filter((error) => error.severity === "error") ?? [];
  if (fatal.length > 0) {
    throw new Error(fatal.map((error) => error.formattedMessage ?? error.message).join("\n"));
  }
  const contract = parsed.contracts?.["AccruedSwapRouter.sol"]?.AccruedSwapRouter;
  if (!contract?.evm.bytecode.object) {
    throw new Error("Compiler did not emit AccruedSwapRouter bytecode.");
  }
  return {
    abi: contract.abi as Abi,
    bytecode: `0x${contract.evm.bytecode.object}` as Hex,
  };
}

async function main() {
  const key = readPrivateKey();
  const account = privateKeyToAccount(key);
  const { bytecode, abi } = compileRouter();
  const wallet = createWalletClient({
    account,
    chain: robinhoodChain,
    transport: http(),
  });
  const publicClient = createPublicClient({
    chain: robinhoodChain,
    transport: http(),
  });

  console.log(`Deployer: ${account.address}`);
  console.log(`SwapRouter02: ${SWAP_ROUTER_02}`);
  console.log(`WETH: ${ROBINHOOD_WETH}`);

  const hash = await wallet.deployContract({
    abi,
    bytecode,
    args: [SWAP_ROUTER_02, ROBINHOOD_WETH],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`Deploy failed: ${hash}`);
  }

  console.log(`AccruedSwapRouter: ${receipt.contractAddress}`);
  console.log(`Tx: ${robinhoodChain.blockExplorers.default.url}/tx/${hash}`);
  console.log("");
  console.log("Next:");
  console.log(`ACCRUED_SWAP_ROUTER_ADDRESS=${receipt.contractAddress}`);
  console.log(`NEXT_PUBLIC_ACCRUED_SWAP_ROUTER_ADDRESS=${receipt.contractAddress}`);
  console.log("Submit this contract to Dune for decoding.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
