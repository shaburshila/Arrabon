import type { Address } from "viem";

import type {
  ComplianceProviderId,
  ComplianceReasonCode,
} from "@/lib/db/types";

export type BlockingReasonCode = Exclude<ComplianceReasonCode, "NO_HIT" | "FRAUD_SIGNAL">;
export type ProviderAuditId = Exclude<ComplianceProviderId, "composite">;

export type ComplianceScreeningAction =
  | "link_create"
  | "funding_prepare"
  | "lifecycle_complete"
  | "lifecycle_release"
  | "lifecycle_auto_release"
  | "admin_resolve_release"
  | "admin_resolve_refund"
  | "post_funding_sync";

export interface ComplianceScreeningContext {
  action: ComplianceScreeningAction;
  actorWallet: string | null;
  dealId: string | null;
}

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
export type ProviderAuditScreeningResult =
  | (BlockedScreeningResult & { provider: ProviderAuditId })
  | (ClearScreeningResult & { provider: ProviderAuditId })
  | (ReviewScreeningResult & { provider: ProviderAuditId });

export type CacheableScreeningResult =
  | ClearScreeningResult
  | (BlockedScreeningResult & { reasonCode: Exclude<BlockingReasonCode, "PROVIDER_UNAVAILABLE"> });

export interface CompositeScreeningRawSummary {
  matches?: ScreeningResult[];
  provider?: ComplianceProviderId | null;
  providerResults: ScreeningResult[];
  results?: ScreeningResult[];
  selectedReasonCode?: ComplianceReasonCode;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isProviderAuditId(value: unknown): value is ProviderAuditId {
  return (
    value === "chainalysis_sanctions_oracle" ||
    value === "usdc_blacklist" ||
    value === "local_denylist" ||
    value === "ofac_sdn" ||
    value === "chainabuse"
  );
}

export function isProviderAuditScreeningResult(
  value: unknown,
): value is ProviderAuditScreeningResult {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (!isProviderAuditId(value.provider)) {
    return false;
  }

  if (value.result !== "Clear" && value.result !== "Review" && value.result !== "Blocked") {
    return false;
  }

  return typeof value.normalizedWallet === "string" && typeof value.reasonCode === "string";
}

export function extractProviderResultsFromCompositeResult(
  result: ScreeningResult,
): ProviderAuditScreeningResult[] | null {
  if (!isObjectRecord(result.rawSummary)) {
    return null;
  }

  const providerResults = result.rawSummary.providerResults;
  if (!Array.isArray(providerResults)) {
    return null;
  }

  if (!providerResults.every((entry) => isProviderAuditScreeningResult(entry))) {
    return null;
  }

  return providerResults;
}

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
