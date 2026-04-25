import "server-only";

import { getAddress } from "viem";

import { findByWallet } from "@/server/repositories/wallet-denylist";
import type {
  ComplianceProvider,
  ProviderScreeningResult,
} from "@/lib/compliance/types";

interface LocalDenylistDependencies {
  findWallet?: typeof findByWallet;
}

export function createLocalDenylistProvider(
  dependencies: LocalDenylistDependencies = {},
): ComplianceProvider {
  const findWallet = dependencies.findWallet ?? findByWallet;

  return {
    id: "local_denylist" as const,
    async screenWallet(address: string): Promise<ProviderScreeningResult> {
      const walletAddress = getAddress(address);
      const normalizedWallet = walletAddress.toLowerCase();

      try {
        const entry = await findWallet(normalizedWallet);

        if (!entry) {
          return {
            normalizedWallet,
            provider: "local_denylist",
            rawSummary: { match: false },
            reasonCode: "NO_HIT",
            result: "Clear",
            walletAddress,
          };
        }

        return {
          normalizedWallet,
          provider: "local_denylist",
          rawSummary: {
            addedAt: entry.added_at,
            addedByWallet: entry.added_by_wallet,
            match: true,
            notes: entry.notes,
            reason: entry.reason,
          },
          reasonCode: "LOCAL_DENYLIST",
          result: "Blocked",
          walletAddress,
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown provider error";

        return {
          normalizedWallet,
          provider: "local_denylist",
          rawSummary: {
            message,
            repository: "wallet_denylist",
            status: "provider_unavailable",
          },
          reasonCode: "PROVIDER_UNAVAILABLE",
          result: "Blocked",
          walletAddress,
        };
      }
    },
  };
}
