import { createPublicClient, http, type Address, erc20Abi } from "viem";
import { robinhoodChain, ROBINHOOD_CHAIN_ID } from "./robinhood";

const client = createPublicClient({
  chain: robinhoodChain,
  transport: http("https://rpc.mainnet.chain.robinhood.com"),
});

export type ResolvedToken = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  logoURI: string | undefined;
};

/**
 * Resolve an arbitrary ERC-20 contract address on Robinhood Chain.
 * Reads symbol(), name(), decimals() on-chain.
 * Returns null if the address is not a valid ERC-20.
 */
export async function resolveErc20(
  address: string,
): Promise<ResolvedToken | null> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return null;

  try {
    const addr = address as Address;
    const [symbol, name, decimals] = await Promise.all([
      client.readContract({ address: addr, abi: erc20Abi, functionName: "symbol" }),
      client.readContract({ address: addr, abi: erc20Abi, functionName: "name" }),
      client.readContract({ address: addr, abi: erc20Abi, functionName: "decimals" }),
    ]);

    const logoURI = `https://cdn.robinhood.com/ncw_assets/logos/${address.toLowerCase()}.png`;

    return {
      address,
      symbol: symbol as string,
      name: name as string,
      decimals: Number(decimals),
      chainId: ROBINHOOD_CHAIN_ID,
      logoURI,
    };
  } catch {
    return null;
  }
}
