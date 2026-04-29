import "server-only";

import { getAddress, type Address } from "viem";

import { getUsdcDevMockMode } from "@/lib/compliance/dev-mode";
import type {
  ComplianceProvider,
  ProviderScreeningResult,
} from "@/lib/compliance/types";

function createProviderUnavailableResult(walletAddress: Address): ProviderScreeningResult {
  return {
    normalizedWallet: walletAddress.toLowerCase(),
    provider: "usdc_blacklist",
    rawSummary: {
      mode: "unavailable",
      source: "usdc_dev_mock",
      status: "provider_unavailable",
    },
    reasonCode: "PROVIDER_UNAVAILABLE",
    result: "Blocked",
    walletAddress,
  };
}

export function createUsdcDevProvider(): ComplianceProvider {
  const mode = getUsdcDevMockMode();

  return {
    id: "usdc_blacklist" as const,
    async screenWallet(address: string): Promise<ProviderScreeningResult> {
      const walletAddress = getAddress(address);
      const normalizedWallet = walletAddress.toLowerCase();

      switch (mode) {
        case "blocked":
          return {
            normalizedWallet,
            provider: "usdc_blacklist",
            rawSummary: {
              isBlacklisted: true,
              mode,
              source: "usdc_dev_mock",
            },
            reasonCode: "USDC_BLACKLISTED",
            result: "Blocked",
            walletAddress,
          };
        case "unavailable":
          return createProviderUnavailableResult(walletAddress);
        case "clear":
        default:
          return {
            normalizedWallet,
            provider: "usdc_blacklist",
            rawSummary: {
              isBlacklisted: false,
              mode,
              source: "usdc_dev_mock",
            },
            reasonCode: "NO_HIT",
            result: "Clear",
            walletAddress,
          };
      }
    },
  };
}
