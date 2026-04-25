import type { Address } from "viem";

import type {
  ComplianceProviderId,
  ComplianceReasonCode,
} from "@/lib/db/types";

export type BlockingReasonCode = Exclude<ComplianceReasonCode, "NO_HIT" | "FRAUD_SIGNAL">;

export interface ComplianceProvider {
  readonly id: ComplianceProviderId;
  screenWallet(address: string): Promise<ScreeningResult>;
}

export interface ScreeningResultBase {
  normalizedWallet: string;
  provider: ComplianceProviderId | null;
  rawSummary: Record<string, unknown>;
  walletAddress: Address;
}

export interface ClearScreeningResult extends ScreeningResultBase {
  reasonCode: "NO_HIT";
  result: "Clear";
}

export interface ReviewScreeningResult extends ScreeningResultBase {
  reasonCode: "FRAUD_SIGNAL";
  result: "Review";
}

export interface BlockedScreeningResult extends ScreeningResultBase {
  reasonCode: BlockingReasonCode;
  result: "Blocked";
}

export type ScreeningResult =
  | BlockedScreeningResult
  | ClearScreeningResult
  | ReviewScreeningResult;

export type ProviderScreeningResult = BlockedScreeningResult | ClearScreeningResult;

export type CacheableScreeningResult =
  | ClearScreeningResult
  | (BlockedScreeningResult & { reasonCode: Exclude<BlockingReasonCode, "PROVIDER_UNAVAILABLE"> });

export function isProviderUnavailableResult(
  result: ProviderScreeningResult | ScreeningResult,
): result is BlockedScreeningResult & { reasonCode: "PROVIDER_UNAVAILABLE" } {
  return result.result === "Blocked" && result.reasonCode === "PROVIDER_UNAVAILABLE";
}

export function isCacheableScreeningResult(
  result: ProviderScreeningResult,
): result is CacheableScreeningResult {
  return !isProviderUnavailableResult(result);
}
