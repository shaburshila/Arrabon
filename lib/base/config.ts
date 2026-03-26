import { resolveBaseChain } from "@/lib/base/chains";

function parseChainId(value: string | undefined) {
  if (!value) {
    return 8453;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : 8453;
}

const chainId = parseChainId(process.env.NEXT_PUBLIC_BASE_CHAIN_ID);
const chain = resolveBaseChain(chainId);

export const baseRuntimeConfig = {
  chain,
  chainId: chain.id,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL?.trim() || chain.rpcUrls.default.http[0],
  paymasterProxyUrl: process.env.NEXT_PUBLIC_PAYMASTER_PROXY_URL?.trim() || "",
  builderCode: process.env.NEXT_PUBLIC_BUILDER_CODE?.trim() || "",
  treasuryWallet: process.env.NEXT_PUBLIC_TREASURY_WALLET?.trim() || "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "",
} as const;
