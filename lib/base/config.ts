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

// Base mainnet USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
// Base Sepolia mock USDC: set via NEXT_PUBLIC_USDC_ADDRESS env
const defaultUsdcAddress =
  chainId === 8453
    ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    : "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC

export const baseRuntimeConfig = {
  chain,
  chainId: chain.id,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL?.trim() || chain.rpcUrls.default.http[0],
  paymasterProxyUrl: process.env.NEXT_PUBLIC_PAYMASTER_PROXY_URL?.trim() || "",
  builderCode: process.env.NEXT_PUBLIC_BUILDER_CODE?.trim() || "",
  treasuryWallet: process.env.NEXT_PUBLIC_TREASURY_WALLET?.trim() || "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "",
  usdcAddress: process.env.NEXT_PUBLIC_USDC_ADDRESS?.trim() || defaultUsdcAddress,
} as const;
