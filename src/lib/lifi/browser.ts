import { createClient, convertQuoteToRoute, executeRoute, type LiFiStep, type RouteExtended } from "@lifi/sdk";
import { EthereumProvider } from "@lifi/sdk-provider-ethereum";
import { getWalletClient, switchChain } from "wagmi/actions";
import { wagmiConfig } from "@/lib/wallet/wagmi";
import { LIFI_INTEGRATOR } from "./constants";

let client: ReturnType<typeof createClient> | null = null;

export function getBrowserLifiClient() {
  if (client) return client;
  client = createClient({
    integrator: LIFI_INTEGRATOR,
  });
  client.setProviders([
    EthereumProvider({
      getWalletClient: () => getWalletClient(wagmiConfig),
      switchChain: async (chainId: number) => {
        const supported = wagmiConfig.chains.find((chain) => chain.id === chainId);
        if (!supported) {
          throw new Error(`unsupported_switch_chain:${chainId}`);
        }
        const chain = await switchChain(wagmiConfig, { chainId: supported.id });
        return getWalletClient(wagmiConfig, { chainId: chain.id });
      },
    }),
  ]);
  return client;
}

export async function executeQuotedSwap(
  quote: LiFiStep,
  onUpdate: (route: RouteExtended) => void,
) {
  const lifi = getBrowserLifiClient();
  const route = convertQuoteToRoute(quote);
  return executeRoute(lifi, route, {
    updateRouteHook: onUpdate,
    acceptExchangeRateUpdateHook: async ({ oldToAmount, newToAmount }) => {
      const previous = Number(oldToAmount);
      const next = Number(newToAmount);
      if (!Number.isFinite(previous) || previous === 0) return true;
      return Math.abs(next - previous) / previous <= 0.03;
    },
  });
}

export function firstExecutionHash(route: RouteExtended): string | null {
  for (const step of route.steps) {
    for (const action of step.execution?.actions ?? []) {
      if (action.txHash?.startsWith("0x") && action.txHash.length === 66) {
        return action.txHash;
      }
    }
  }
  return null;
}
