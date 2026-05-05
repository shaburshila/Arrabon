import "server-only";

import { getAddress } from "viem";

import {
  createCompositeComplianceProvider,
} from "@/lib/compliance/composite";
import type {
  ComplianceScreeningContext,
  ProviderAuditScreeningResult,
  ScreeningResult,
} from "@/lib/compliance/types";
import { extractProviderResultsFromCompositeResult } from "@/lib/compliance/types";
import type {
  ComplianceCheckRow,
  DealRiskStatus,
} from "@/lib/db/types";
import {
  ComplianceChecksRepositoryError,
  createComplianceCheck,
  findBlockedByDeal,
  findByDeal,
} from "@/server/repositories/compliance-checks";
import {
  DealsRepositoryError,
  getById,
  updateRiskStatusById,
} from "@/server/repositories/deals";
import { ComplianceBlockedError } from "@/lib/compliance/error-mapping";
import type { BlockingReasonCode } from "@/lib/compliance/types";

export class ComplianceServiceError extends Error {
  cause?: unknown;
  code: string;

  constructor(message: string, code: string, cause?: unknown) {
    super(message);
    this.name = "ComplianceServiceError";
    this.code = code;
    this.cause = cause;
  }
}

const WALLET_SUBJECT_TYPE = "wallet" as const;

function normalizeWallet(wallet: string): string {
  return getAddress(wallet).toLowerCase();
}

function normalizeActorWallet(wallet: string | null): string | null {
  return wallet ? normalizeWallet(wallet) : null;
}

function resolveRiskStatusFromChecks(checks: readonly ComplianceCheckRow[]): DealRiskStatus {
  if (checks.some((check) => check.result === "Blocked")) {
    return "Blocked";
  }

  if (checks.some((check) => check.result === "Review")) {
    return "Review";
  }

  return "Clear";
}

const BLOCKING_REASON_PRIORITY: Record<BlockingReasonCode, number> = {
  LOCAL_DENYLIST: 2,
  OFAC_SANCTIONS: 4,
  PROVIDER_UNAVAILABLE: 1,
  USDC_BLACKLISTED: 3,
};

function compareBlockedChecks(left: ComplianceCheckRow, right: ComplianceCheckRow): number {
  const leftPriority = BLOCKING_REASON_PRIORITY[left.reason_code as BlockingReasonCode] ?? 0;
  const rightPriority = BLOCKING_REASON_PRIORITY[right.reason_code as BlockingReasonCode] ?? 0;

  if (leftPriority !== rightPriority) {
    return rightPriority - leftPriority;
  }

  const leftCheckedAt = new Date(left.checked_at).getTime();
  const rightCheckedAt = new Date(right.checked_at).getTime();

  if (leftCheckedAt !== rightCheckedAt) {
    return rightCheckedAt - leftCheckedAt;
  }

  return right.id.localeCompare(left.id);
}

function getCompositeProvider() {
  return createCompositeComplianceProvider();
}

async function persistProviderResults(
  providerResults: readonly ProviderAuditScreeningResult[],
  ctx: ComplianceScreeningContext,
): Promise<void> {
  const actorWallet = normalizeActorWallet(ctx.actorWallet);

  for (const providerResult of providerResults) {
    try {
      await createComplianceCheck({
        actorWallet,
        dealId: ctx.dealId,
        provider: providerResult.provider,
        rawSummary: providerResult.rawSummary,
        reasonCode: providerResult.reasonCode,
        result: providerResult.result,
        subjectType: WALLET_SUBJECT_TYPE,
        subjectValue: providerResult.normalizedWallet,
      });
    } catch (error) {
      if (error instanceof ComplianceChecksRepositoryError) {
        throw new ComplianceServiceError(
          "Failed to persist compliance audit trail.",
          "AUDIT_WRITE_FAILED",
          error,
        );
      }

      throw new ComplianceServiceError(
        "Failed to persist compliance audit trail.",
        "AUDIT_WRITE_FAILED",
        error,
      );
    }
  }
}

function extractProviderResultsOrThrow(
  result: ScreeningResult,
): ProviderAuditScreeningResult[] {
  const providerResults = extractProviderResultsFromCompositeResult(result);

  if (!providerResults) {
    throw new ComplianceServiceError(
      "Composite provider result did not expose provider-level audit data.",
      "INVALID_PROVIDER_SUMMARY",
    );
  }

  return providerResults;
}

function emitProviderUnavailableEvents(
  providerResults: readonly ProviderAuditScreeningResult[],
  ctx: ComplianceScreeningContext,
  walletCount: number,
): void {
  for (const providerResult of providerResults) {
    if (providerResult.result !== "Blocked" || providerResult.reasonCode !== "PROVIDER_UNAVAILABLE") {
      continue;
    }

    console.info("provider_unavailable_rate", {
      action: ctx.action,
      dealId: ctx.dealId,
      provider: providerResult.provider,
      walletAddress: providerResult.walletAddress,
      walletCount,
    });
  }
}

export async function screenWalletForDeal(
  wallet: string,
  ctx: ComplianceScreeningContext,
): Promise<ScreeningResult> {
  const startedAt = Date.now();
  let result: ScreeningResult;

  try {
    result = await getCompositeProvider().screenWallet(wallet);
  } catch (error) {
    console.info("compliance_check_duration", {
      action: ctx.action,
      dealId: ctx.dealId,
      durationMs: Date.now() - startedAt,
      errorCode: "SCREENING_FAILED",
      outcome: "failed",
      walletCount: 1,
    });

    throw new ComplianceServiceError(
      "Failed to screen wallet.",
      "SCREENING_FAILED",
      error,
    );
  }

  console.info("compliance_check_duration", {
    action: ctx.action,
    dealId: ctx.dealId,
    durationMs: Date.now() - startedAt,
    outcome: "succeeded",
    reasonCode: result.reasonCode,
    walletCount: 1,
  });

  const providerResults = extractProviderResultsOrThrow(result);
  emitProviderUnavailableEvents(providerResults, ctx, 1);
  await persistProviderResults(providerResults, ctx);

  if (ctx.dealId) {
    await recomputeDealRiskStatus(ctx.dealId);
  }

  return result;
}

export async function screenWalletsBatch(
  wallets: readonly string[],
  ctx: ComplianceScreeningContext,
): Promise<ScreeningResult[]> {
  const startedAt = Date.now();
  let results: ScreeningResult[];

  try {
    const compositeProvider = getCompositeProvider();
    results = await Promise.all(wallets.map((wallet) => compositeProvider.screenWallet(wallet)));
  } catch (error) {
    console.info("compliance_check_duration", {
      action: ctx.action,
      dealId: ctx.dealId,
      durationMs: Date.now() - startedAt,
      errorCode: "SCREENING_FAILED",
      outcome: "failed",
      walletCount: wallets.length,
    });

    throw new ComplianceServiceError(
      "Failed to screen wallet batch.",
      "SCREENING_FAILED",
      error,
    );
  }

  console.info("compliance_check_duration", {
    action: ctx.action,
    dealId: ctx.dealId,
    durationMs: Date.now() - startedAt,
    outcome: "succeeded",
    walletCount: wallets.length,
  });

  const providerResults = results.flatMap((result) => extractProviderResultsOrThrow(result));
  emitProviderUnavailableEvents(providerResults, ctx, wallets.length);
  await persistProviderResults(providerResults, ctx);

  if (ctx.dealId) {
    await recomputeDealRiskStatus(ctx.dealId);
  }

  return results;
}

export async function recomputeDealRiskStatus(dealId: string): Promise<DealRiskStatus> {
  let deal;
  let checks;

  try {
    deal = await getById(dealId);
  } catch (error) {
    if (error instanceof DealsRepositoryError) {
      throw new ComplianceServiceError(
        "Failed to load deal for risk recompute.",
        "RISK_STATUS_RECOMPUTE_FAILED",
        error,
      );
    }

    throw new ComplianceServiceError(
      "Failed to load deal for risk recompute.",
      "RISK_STATUS_RECOMPUTE_FAILED",
      error,
    );
  }

  if (!deal) {
    throw new ComplianceServiceError(
      "Deal not found for risk recompute.",
      "DEAL_NOT_FOUND",
    );
  }

  try {
    checks = await findByDeal(dealId);
  } catch (error) {
    if (error instanceof ComplianceChecksRepositoryError) {
      throw new ComplianceServiceError(
        "Failed to load compliance history for deal.",
        "RISK_STATUS_RECOMPUTE_FAILED",
        error,
      );
    }

    throw new ComplianceServiceError(
      "Failed to load compliance history for deal.",
      "RISK_STATUS_RECOMPUTE_FAILED",
      error,
    );
  }

  if (checks.length === 0) {
    return deal.risk_status;
  }

  const nextRiskStatus = resolveRiskStatusFromChecks(checks);
  if (nextRiskStatus === deal.risk_status) {
    return deal.risk_status;
  }

  try {
    const updatedDeal = await updateRiskStatusById(dealId, nextRiskStatus);
    return updatedDeal.risk_status;
  } catch (error) {
    if (error instanceof DealsRepositoryError) {
      throw new ComplianceServiceError(
        "Failed to update deal risk status.",
        "RISK_STATUS_RECOMPUTE_FAILED",
        error,
      );
    }

    throw new ComplianceServiceError(
      "Failed to update deal risk status.",
      "RISK_STATUS_RECOMPUTE_FAILED",
      error,
    );
  }
}

export async function assertDealNotBlocked(dealId: string): Promise<void> {
  let blockedChecks: ComplianceCheckRow[];

  try {
    blockedChecks = await findBlockedByDeal(dealId);
  } catch (error) {
    if (error instanceof ComplianceChecksRepositoryError) {
      throw new ComplianceServiceError(
        "Failed to load blocked compliance history for deal.",
        "BLOCKING_CHECK_LOAD_FAILED",
        error,
      );
    }

    throw new ComplianceServiceError(
      "Failed to load blocked compliance history for deal.",
      "BLOCKING_CHECK_LOAD_FAILED",
      error,
    );
  }

  if (blockedChecks.length === 0) {
    return;
  }

  const [selectedCheck] = [...blockedChecks].sort(compareBlockedChecks);

  throw new ComplianceBlockedError({
    dealId,
    provider: selectedCheck.provider,
    reasonCode: selectedCheck.reason_code as BlockingReasonCode,
    walletAddress: selectedCheck.subject_value,
  });
}
