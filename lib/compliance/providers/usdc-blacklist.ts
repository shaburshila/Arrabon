import "server-only";

import { getAddress, type Address } from "viem";

import { getComplianceConfig } from "@/lib/compliance/config";
import { getCompliancePublicClient } from "@/lib/compliance/public-client";
import type {
  ComplianceProvider,
  ProviderScreeningResult,
} from "@/lib/compliance/types";

const usdcBlacklistAbi = [
  {
    inputs: [{ name: "_account", type: "address" }],
    name: "isBlacklisted",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface ComplianceContractReader {
  readContract(parameters: {
    abi: readonly unknown[];
    address: Address;
    args: readonly [Address];
    functionName: "isBlacklisted";
  }): Promise<boolean>;
}

interface UsdcBlacklistProviderDependencies {
  client?: ComplianceContractReader;
  usdcAddress?: Address;
}

function createProviderUnavailableResult(walletAddress: Address): ProviderScreeningResult {
  return {
    normalizedWallet: walletAddress.toLowerCase(),
    provider: "usdc_blacklist",
    rawSummary: { status: "provider_unavailable" },
    reasonCode: "PROVIDER_UNAVAILABLE",
    result: "Blocked",
    walletAddress,
  };
}

export function createUsdcBlacklistProvider(
  dependencies: UsdcBlacklistProviderDependencies = {},
): ComplianceProvider {
  const client = dependencies.client ?? getCompliancePublicClient();
  const usdcAddress = dependencies.usdcAddress ?? getComplianceConfig().usdcAddress;

  return {
    id: "usdc_blacklist" as const,
    async screenWallet(address: string): Promise<ProviderScreeningResult> {
      const walletAddress = getAddress(address);

      try {
        const isBlacklisted = await client.readContract({
          abi: usdcBlacklistAbi,
          address: usdcAddress,
          args: [walletAddress],
          functionName: "isBlacklisted",
        });

        if (isBlacklisted) {
          return {
            normalizedWallet: walletAddress.toLowerCase(),
            provider: "usdc_blacklist",
            rawSummary: { isBlacklisted: true, usdcAddress },
            reasonCode: "USDC_BLACKLISTED",
            result: "Blocked",
            walletAddress,
          };
        }

        return {
          normalizedWallet: walletAddress.toLowerCase(),
          provider: "usdc_blacklist",
          rawSummary: { isBlacklisted: false, usdcAddress },
          reasonCode: "NO_HIT",
          result: "Clear",
          walletAddress,
        };
      } catch (error) {
        return {
          ...createProviderUnavailableResult(walletAddress),
          rawSummary: {
            message: error instanceof Error ? error.message : "Unknown provider error",
            status: "provider_unavailable",
          },
        };
      }
    },
  };
}
