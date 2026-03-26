import { base, baseSepolia } from "viem/chains";

const CHAIN_REGISTRY = {
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
} as const;

export function resolveBaseChain(chainId: number) {
  return CHAIN_REGISTRY[chainId as keyof typeof CHAIN_REGISTRY] ?? base;
}

export const supportedBaseChains = [base, baseSepolia] as const;
