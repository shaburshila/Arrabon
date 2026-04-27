import "server-only";

import { getAddress } from "viem";

import { getComplianceCache } from "@/lib/compliance/cache";
import {
  getComplianceCircuitBreaker,
  type ComplianceCircuitBreaker,
} from "@/lib/compliance/circuit-breaker";
import { getComplianceConfig } from "@/lib/compliance/config";
import { createChainalysisOracleProvider } from "@/lib/compliance/providers/chainalysis-oracle";
import { createLocalDenylistProvider } from "@/lib/compliance/providers/local-denylist";
import { createUsdcBlacklistProvider } from "@/lib/compliance/providers/usdc-blacklist";
import type {
  BlockedScreeningResult,
  ComplianceProvider,
  ProviderScreeningResult,
  ScreeningResult,
} from "@/lib/compliance/types";
import {
  isCacheableScreeningResult,
  isProviderUnavailableResult,
} from "@/lib/compliance/types";

const BLOCKING_REASON_PRIORITY = [
  "OFAC_SANCTIONS",
  "USDC_BLACKLISTED",
  "LOCAL_DENYLIST",
] as const;

function createProviderUnavailableResult(
  provider: ComplianceProvider,
  walletAddress: `0x${string}`,
): BlockedScreeningResult {
  return {
    normalizedWallet: walletAddress.toLowerCase(),
    provider: provider.id,
    rawSummary: { provider: provider.id, status: "provider_unavailable" },
    reasonCode: "PROVIDER_UNAVAILABLE",
    result: "Blocked",
    walletAddress,
  };
}

function compareReasonPriority(
  left: BlockedScreeningResult,
  right: BlockedScreeningResult,
): number {
  const leftIndex = BLOCKING_REASON_PRIORITY.indexOf(
    left.reasonCode as (typeof BLOCKING_REASON_PRIORITY)[number],
  );
  const rightIndex = BLOCKING_REASON_PRIORITY.indexOf(
    right.reasonCode as (typeof BLOCKING_REASON_PRIORITY)[number],
  );

  return leftIndex - rightIndex;
}

export interface CompositeComplianceDependencies {
  breaker?: ComplianceCircuitBreaker;
  cache?: ReturnType<typeof getComplianceCache>;
  providers?: readonly ComplianceProvider[];
}

function createDefaultProviders(): readonly ComplianceProvider[] {
  return [
    createChainalysisOracleProvider(),
    createUsdcBlacklistProvider(),
    createLocalDenylistProvider(),
  ];
}

export function createCompositeComplianceProvider(
  dependencies: CompositeComplianceDependencies = {},
): ComplianceProvider {
  const cache = dependencies.cache ?? getComplianceCache();
  const providers = dependencies.providers ?? createDefaultProviders();
  const breaker =
    dependencies.breaker ??
    (() => {
      const config = getComplianceConfig();
      return getComplianceCircuitBreaker({
        failureThreshold: config.circuitBreakerFailureThreshold,
        resetMs: config.circuitBreakerResetMs,
        windowMs: config.circuitBreakerWindowMs,
      });
    })();

  return {
    id: "composite" as const,
    async screenWallet(address: string): Promise<ScreeningResult> {
      const walletAddress = getAddress(address);
      const normalizedWallet = walletAddress.toLowerCase();
      const results = await Promise.all(
        providers.map(async (provider) => {
          const cached = cache.get(provider.id, normalizedWallet);
          if (cached) {
            return cached;
          }

          if (!breaker.canRequest(provider.id)) {
            return createProviderUnavailableResult(provider, walletAddress);
          }

          const result = await provider.screenWallet(walletAddress);

          if (isProviderUnavailableResult(result)) {
            breaker.recordFailure(provider.id);
            return result;
          }

          breaker.recordSuccess(provider.id);

          if (result.result === "Review") {
            return result;
          }

          if (isCacheableScreeningResult(result)) {
            cache.set(provider.id, normalizedWallet, result);
          }

          return result;
        }),
      );

      const blockingHits = results.filter(
        (result): result is BlockedScreeningResult =>
          result.result === "Blocked" && result.reasonCode !== "PROVIDER_UNAVAILABLE",
      );

      if (blockingHits.length > 0) {
        const topHit = [...blockingHits].sort(compareReasonPriority)[0];

        return {
          ...topHit,
          provider: topHit.provider,
          rawSummary: {
            matches: results,
            providerResults: results,
            selectedReasonCode: topHit.reasonCode,
          },
        };
      }

      const providerUnavailable = results.find((result) => isProviderUnavailableResult(result));
      if (providerUnavailable) {
        return {
          ...providerUnavailable,
          rawSummary: {
            provider: providerUnavailable.provider,
            providerResults: results,
            results,
            selectedReasonCode: providerUnavailable.reasonCode,
          },
        };
      }

      return {
        normalizedWallet,
        provider: null,
        rawSummary: { providerResults: results, results },
        reasonCode: "NO_HIT",
        result: "Clear",
        walletAddress,
      };
    },
  };
}
