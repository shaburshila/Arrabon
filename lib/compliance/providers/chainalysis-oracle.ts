import "server-only";

import { getAddress, type Address } from "viem";

import { getComplianceConfig } from "@/lib/compliance/config";
import { getCompliancePublicClient } from "@/lib/compliance/public-client";
import type {
  ComplianceProvider,
  ProviderScreeningResult,
} from "@/lib/compliance/types";

const sanctionsOracleAbi = [
  {
    inputs: [{ name: "addr", type: "address" }],
    name: "isSanctioned",
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
    functionName: "isSanctioned";
  }): Promise<boolean>;
}

interface ChainalysisOracleProviderDependencies {
  client?: ComplianceContractReader;
  oracleAddress?: Address;
}

function createProviderUnavailableResult(walletAddress: Address): ProviderScreeningResult {
  return {
    normalizedWallet: walletAddress.toLowerCase(),
    provider: "chainalysis_sanctions_oracle",
    rawSummary: { status: "provider_unavailable" },
    reasonCode: "PROVIDER_UNAVAILABLE",
    result: "Blocked",
    walletAddress,
  };
}

export function createChainalysisOracleProvider(
  dependencies: ChainalysisOracleProviderDependencies = {},
): ComplianceProvider {
  const client = dependencies.client ?? getCompliancePublicClient();
  const chainalysisOracleAddress =
    dependencies.oracleAddress ?? getComplianceConfig().chainalysisOracleAddress;

  return {
    id: "chainalysis_sanctions_oracle" as const,
    async screenWallet(address: string): Promise<ProviderScreeningResult> {
      const walletAddress = getAddress(address);

      try {
        const isSanctioned = await client.readContract({
          abi: sanctionsOracleAbi,
          address: chainalysisOracleAddress,
          args: [walletAddress],
          functionName: "isSanctioned",
        });

        if (isSanctioned) {
          return {
            normalizedWallet: walletAddress.toLowerCase(),
            provider: "chainalysis_sanctions_oracle",
            rawSummary: { isSanctioned: true, oracleAddress: chainalysisOracleAddress },
            reasonCode: "OFAC_SANCTIONS",
            result: "Blocked",
            walletAddress,
          };
        }

        return {
          normalizedWallet: walletAddress.toLowerCase(),
          provider: "chainalysis_sanctions_oracle",
          rawSummary: { isSanctioned: false, oracleAddress: chainalysisOracleAddress },
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
