import "server-only";

import { getAddress, type Address } from "viem";

import { getChainalysisDevMockMode } from "@/lib/compliance/dev-mode";
import type {
  ComplianceProvider,
  ProviderScreeningResult,
} from "@/lib/compliance/types";

function createProviderUnavailableResult(walletAddress: Address): ProviderScreeningResult {
  return {
    normalizedWallet: walletAddress.toLowerCase(),
    provider: "chainalysis_sanctions_oracle",
    rawSummary: {
      mode: "unavailable",
      source: "chainalysis_dev_mock",
      status: "provider_unavailable",
    },
    reasonCode: "PROVIDER_UNAVAILABLE",
    result: "Blocked",
    walletAddress,
  };
}

export function createChainalysisDevProvider(): ComplianceProvider {
  const mode = getChainalysisDevMockMode();

  return {
    id: "chainalysis_sanctions_oracle" as const,
    async screenWallet(address: string): Promise<ProviderScreeningResult> {
      const walletAddress = getAddress(address);
      const normalizedWallet = walletAddress.toLowerCase();

      switch (mode) {
        case "blocked":
          return {
            normalizedWallet,
            provider: "chainalysis_sanctions_oracle",
            rawSummary: {
              isSanctioned: true,
              mode,
              source: "chainalysis_dev_mock",
            },
            reasonCode: "OFAC_SANCTIONS",
            result: "Blocked",
            walletAddress,
          };
        case "unavailable":
          return createProviderUnavailableResult(walletAddress);
        case "clear":
        default:
          return {
            normalizedWallet,
            provider: "chainalysis_sanctions_oracle",
            rawSummary: {
              isSanctioned: false,
              mode,
              source: "chainalysis_dev_mock",
            },
            reasonCode: "NO_HIT",
            result: "Clear",
            walletAddress,
          };
      }
    },
  };
}
