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
  findByDeal,
} from "@/server/repositories/compliance-checks";
import {
  DealsRepositoryError,
  getById,
  updateRiskStatusById,
} from "@/server/repositories/deals";

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

export async function screenWalletForDeal(
  wallet: string,
  ctx: ComplianceScreeningContext,
): Promise<ScreeningResult> {
  let result: ScreeningResult;

  try {
    result = await getCompositeProvider().screenWallet(wallet);
  } catch (error) {
    throw new ComplianceServiceError(
      "Failed to screen wallet.",
      "SCREENING_FAILED",
      error,
    );
  }

  const providerResults = extractProviderResultsOrThrow(result);
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
  let results: ScreeningResult[];

  try {
    const compositeProvider = getCompositeProvider();
    results = await Promise.all(wallets.map((wallet) => compositeProvider.screenWallet(wallet)));
  } catch (error) {
    throw new ComplianceServiceError(
      "Failed to screen wallet batch.",
      "SCREENING_FAILED",
      error,
    );
  }

  const providerResults = results.flatMap((result) => extractProviderResultsOrThrow(result));
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
