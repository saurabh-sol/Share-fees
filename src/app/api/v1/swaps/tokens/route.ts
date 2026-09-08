import { getSession } from "@/lib/auth/session";
import type { LifiToken } from "@/lib/lifi/http";
import {
  ROBINHOOD_CHAIN_ID,
  ROBINHOOD_STOCKS,
  ROBINHOOD_USDG,
  ROBINHOOD_WETH,
} from "@/lib/chains/robinhood";
import { jsonError } from "@/lib/security/origin";

export const dynamic = "force-dynamic";

/**
 * Ordered token list for Robinhood Chain.
 * Stocks come first so users land on equity trading by default.
 * USDG is the quote currency for all stock pairs.
 */
function buildRobinhoodTokens(): LifiToken[] {
  const stocks: LifiToken[] = ROBINHOOD_STOCKS.map((s) => ({
    address: s.address,
    symbol: s.symbol,
    name: s.name,
    decimals: 18,
    chainId: ROBINHOOD_CHAIN_ID,
    priceUSD: undefined,
    logoURI: s.logoURI,
  }));

  const stables: LifiToken[] = [
    {
      address: ROBINHOOD_USDG,
      symbol: "USDG",
      name: "Global Dollar",
      decimals: 6,
      chainId: ROBINHOOD_CHAIN_ID,
      priceUSD: "1.00",
      logoURI: "https://coin-images.coingecko.com/coins/images/51281/small/GDN_USDG_Token_200x200.png",
    },
  ];

  const gas: LifiToken[] = [
    {
      address: "0x0000000000000000000000000000000000000000",
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      chainId: ROBINHOOD_CHAIN_ID,
      priceUSD: undefined,
      logoURI: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
    },
    {
      address: ROBINHOOD_WETH,
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      chainId: ROBINHOOD_CHAIN_ID,
      priceUSD: undefined,
      logoURI: "https://assets.coingecko.com/coins/images/2518/small/weth.png",
    },
  ];

  // Top trending community & DeFi tokens on Robinhood Chain.
  // Verified contract addresses from Blockscout. All 18 decimals.
  const trending: LifiToken[] = [
    // ─── Top community / DeFi tokens (by market cap + volume) ───
    { address: "0x39dBED3a2bd333467115dE45665cC57F813C4571", symbol: "PONS",        name: "Pons · Launchpad",                decimals: 18, chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://assets.coingecko.com/coins/images/102174571/small/jhitvkisdq8fhxvimdkpcw7y3dx5.?1784093932" },
    { address: "0x020bfC650A365f8BB26819deAAbF3E21291018b4", symbol: "CASHCAT",     name: "Cash Cat",                        decimals: 18, chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://assets.coingecko.com/coins/images/102174280/small/cashcat-logo.jpg?1782922765" },
    { address: "0xe8ffd7e24187F72afB08d75B1bb13088A989a791", symbol: "DELTA",       name: "Delta · Liquidity Protocol",      decimals: 18, chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://robinhoodchain.blockscout.com/token-images/0xe8ffd7e24187f72afb08d75b1bb13088a989a791.png" },
    { address: "0x56910D4409F3a0C78C64DD8D0545FF0705389870", symbol: "INDEX",       name: "The Index · Stock Dividends",     decimals: 18, chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://robinhoodchain.blockscout.com/token-images/0x56910D4409F3a0C78C64DD8D0545FF0705389870.png" },
    { address: "0xe934e36A439C94017B64a3FecE66AF12099aBF50", symbol: "STONKBROKER", name: "StonkBroker · NFT + RWA",          decimals: 18, chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://robinhoodchain.blockscout.com/token-images/0xe934e36A439C94017B64a3FecE66AF12099aBF50.png" },
    { address: "0x18E674231A58c239Dc7DaeDcffE15Ec3A24cff5c", symbol: "HOOKR",       name: "Hookr.fun · Uniswap Hooks",       decimals: 18, chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://robinhoodchain.blockscout.com/token-images/0x18E674231A58c239Dc7DaeDcffE15Ec3A24cff5c.png" },
    { address: "0xCA9c78Dd337A67F6e0077F65F5E9218719d30eDf", symbol: "NET",         name: "NetNet",                          decimals: 9,  chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://assets.coingecko.com/coins/images/102174712/small/netnet_400x400.jpg?1788753885" },
    { address: "0xCEC185eB182c47d1bA1EFc84e6959e18cd620Be4", symbol: "cbBTC",       name: "Coinbase Wrapped BTC",            decimals: 8,  chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://assets.coingecko.com/coins/images/40143/small/cbbtc.webp?1726136727" },
    // ─── Popular meme tokens ───
    { address: "0x73c2dE14C7FA0a57cc2d9722b959eA70B881fFe4", symbol: "BOOMER",      name: "Boomer",                          decimals: 18, chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://assets.coingecko.com/coins/images/102176795/small/boomer.jpg?1788753885" },
    { address: "0xB0E280C6f79BAb2eC58C7D9f2Ee2A14D764751B4", symbol: "HOODIE",      name: "Hoodie",                          decimals: 18, chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://robinhoodchain.blockscout.com/token-images/0xB0E280C6f79BAb2eC58C7D9f2Ee2A14D764751B4.png" },
    { address: "0xfD584f7397Ed0F42266bCa2f8e3fc264aa12d409", symbol: "VLAD",        name: "The Robinhood · Vlad",            decimals: 18, chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://robinhoodchain.blockscout.com/token-images/0xfD584f7397Ed0F42266bCa2f8e3fc264aa12d409.png" },
    { address: "0xD2a577E92438Fd0c1F2485f4FB91B9F866EB1E6C", symbol: "PEPONS",      name: "Pepons",                          decimals: 18, chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://robinhoodchain.blockscout.com/token-images/0xD2a577E92438Fd0c1F2485f4FB91B9F866EB1E6C.png" },
    { address: "0x27efEae1817d90974623cb2eD455C424bEFFA5Ab", symbol: "FRONG",       name: "Frong",                           decimals: 18, chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://robinhoodchain.blockscout.com/token-images/0x27efEae1817d90974623cb2eD455C424bEFFA5Ab.png" },
    { address: "0x6d8f92Cd3b5D4238821670fCA5463560c8d58DaF", symbol: "YOLO",        name: "YOLO",                            decimals: 18, chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://robinhoodchain.blockscout.com/token-images/0x6d8f92Cd3b5D4238821670fCA5463560c8d58DaF.png" },
    // ─── Extra stock tokens (high holders / volume) ───
    { address: "0x8005d266423c7ea827372c9c864491e5786600ea", symbol: "LLY",         name: "Eli Lilly · Robinhood Token",     decimals: 18, chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://cdn.robinhood.com/ncw_assets/logos/0x8005d266423c7ea827372c9c864491e5786600ea.png" },
    { address: "0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD", symbol: "MU",          name: "Micron Technology · Robinhood",   decimals: 18, chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://cdn.robinhood.com/ncw_assets/logos/0xff080c8ce2e5feadaca0da81314ae59d232d4afd.png" },
    { address: "0x4EA005168D7F09a7A0Ba9D1DEf21a479950E44C2", symbol: "COST",        name: "Costco · Robinhood Token",        decimals: 18, chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://cdn.robinhood.com/ncw_assets/logos/0x4ea005168d7f09a7a0ba9d1def21a479950e44c2.png" },
    { address: "0x941AE714EC6D8130c7B75d67160Ca08f1e7d11Dd", symbol: "DELL",        name: "Dell · Robinhood Token",          decimals: 18, chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://cdn.robinhood.com/ncw_assets/logos/0x941ae714ec6d8130c7b75d67160ca08f1e7d11dd.png" },
    { address: "0xea72Ecca2d0f6bFA1394DBBCff85b52CD4233931", symbol: "CRWD",        name: "CrowdStrike · Robinhood Token",   decimals: 18, chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://assets.coingecko.com/coins/images/102174169/small/0xea72ecca2d0f6bfa1394dbbcff85b52cd4233931.png" },
    { address: "0xB90A19fF0Af67f7779afF50A882A9CfF42446400", symbol: "SNDK",        name: "SanDisk · Robinhood Token",       decimals: 18, chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://cdn.robinhood.com/ncw_assets/logos/0xb90a19ff0af67f7779aff50a882a9cff42446400.png" },
    { address: "0x329fcACEb9AD6F9580DD5F643fed0646900D043c", symbol: "LMT",         name: "Lockheed Martin · Robinhood",     decimals: 18, chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://cdn.robinhood.com/ncw_assets/logos/0x329fcaceb9ad6f9580dd5f643fed0646900d043c.png" },
    { address: "0x47F93d52cBeC7C6D2CfC080e154002370a60dAEA", symbol: "ASML",        name: "ASML · Robinhood Token",          decimals: 18, chainId: ROBINHOOD_CHAIN_ID, logoURI: "https://cdn.robinhood.com/ncw_assets/logos/0x47f93d52cbec7c6d2cfc080e154002370a60daea.png" },
  ];

  // Stocks first, trending tokens, then USDG (quote), then ETH/WETH (gas).
  return [...stocks, ...trending, ...stables, ...gas];
}

export async function GET(request: Request) {
  const session = await getSession(request);
  if (!session) {
    return jsonError(401, "unauthenticated", "Sign in with a wallet first.");
  }

  const chainId = Number(new URL(request.url).searchParams.get("chainId"));
  if (chainId !== ROBINHOOD_CHAIN_ID) {
    return jsonError(
      400,
      "unsupported_chain",
      "Swap Studio runs only on Robinhood Chain (id 4663). Switch your wallet network.",
    );
  }

  return Response.json(
    {
      provider: "uniswap",
      tokens: buildRobinhoodTokens(),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
