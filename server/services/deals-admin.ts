import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { ComplianceReasonCode, ComplianceCheckRow, DealRiskStatus } from "@/lib/db/types";
import {
  ConsultEscrowConfigError,
  prepareAdminResolveRefundCall,
  prepareAdminResolveReleaseCall,
  type PreparedDealLifecycleCall,
} from "@/lib/base/consult-escrow";
import type { CurrentUserContext } from "@/lib/auth/guards";
import { computeReleaseDeadlineMs } from "@/lib/constants/deals";
import type { DealRouteParams } from "@/lib/validators/deals";
import type { AdminResolveBody } from "@/lib/validators/deals-admin";
import {
  AdminResolutionIntentsRepositoryError,
  createAdminResolutionIntent,
} from "@/server/repositories/admin-resolution-intents";
import {
  ComplianceChecksRepositoryError,
  findByDealNewestFirst,
} from "@/server/repositories/compliance-checks";
import {
  createPayoutExecutionGrant,
  consumePayoutExecutionGrant,
  PayoutExecutionGrantsRepositoryError,
} from "@/server/repositories/payout-execution-grants";
import {
  DealsRepositoryError,
  getAdminDealReviewRowById,
  getDealActionContextById,
  listDisputedDealReviewRows,
  listResolvedDealReviewRows,
  type AdminDealReviewRow,
} from "@/server/repositories/deals";
import { screenWalletForDeal } from "@/server/services/compliance";
import type { ListPagination } from "@/lib/validators/pagination";

export type AdminResolution = AdminResolveBody["resolution"];

export interface AdminDealReviewModel {
  buyer_address: string;
  completed_at: string | null;
  consultation_link_id: string;
  created_at: string;
  duration_minutes: number;
  expires_at: string;
  id: string;
  onchain_deal_id: string;
  price_usdc: string;
  release_deadline_at: string | null;
  released_at: string | null;
  risk_status: DealRiskStatus;
  resolution_type: AdminDealReviewRow["resolution_type"];
  resolved_at: string | null;
  resolved_by_wallet: string | null;
  resolved_from_status: AdminDealReviewRow["resolved_from_status"];
  scheduled_at: string;
  seller_address: string;
  status: "Disputed";
  timezone: string;
  title: string;
  tx_hash: string | null;
}

type SummaryProviderId =
  | "chainalysis_sanctions_oracle"
  | "usdc_blacklist"
  | "local_denylist";

export interface ComplianceSummaryProvider {
  last_checked_at: string | null;
  latest_reason_code: ComplianceReasonCode | null;
  latest_result: ComplianceCheckRow["result"] | null;
  provider: SummaryProviderId;
}

export interface ComplianceSummary {
  checks_count: number;
  deal_id: string;
  providers: ComplianceSummaryProvider[];
  risk_status: DealRiskStatus;
  wallets: string[];
}

export interface AdminDealReviewDetailsModel extends AdminDealReviewModel {
  compliance_summary: ComplianceSummary;
}

export interface AdminDealComplianceModel {
  checks: ComplianceCheckRow[];
  compliance_summary: ComplianceSummary;
  deal_id: string;
  risk_status: DealRiskStatus;
}

export interface AdminResolvedDealReviewModel {
  buyer_address: string;
  completed_at: string | null;
  consultation_link_id: string;
  created_at: string;
  duration_minutes: number;
  expires_at: string;
  id: string;
  onchain_deal_id: string;
  price_usdc: string;
  released_at: string | null;
  resolution_type: AdminDealReviewRow["resolution_type"];
  resolved_at: string | null;
  resolved_by_wallet: string | null;
  resolved_from_status: AdminDealReviewRow["resolved_from_status"];
  scheduled_at: string;
  seller_address: string;
  status: Extract<AdminDealReviewRow["status"], "Refunded" | "Released">;
  timezone: string;
  title: string;
  tx_hash: string | null;
}

export interface PreparedAdminResolveResult {
  contract_call: PreparedDealLifecycleCall;
  deal_id: string;
  resolution: AdminResolution;
}

export interface AdminResolveGrantIssueResult {
  action: "adminResolveRefund" | "adminResolveRelease";
  deal_id: string;
  expires_at: string;
  grant_token: string;
  resolution: AdminResolution;
}

const PAYOUT_GRANT_TTL_MS = 120_000;

export class DealAdminServiceError extends Error {
  code: string;
  status: number;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "DealAdminServiceError";
    this.code = code;
    this.status = status;
  }
}

const SUMMARY_PROVIDER_IDS: SummaryProviderId[] = [
  "chainalysis_sanctions_oracle",
  "usdc_blacklist",
  "local_denylist",
];

function computeReleaseDeadline(completedAt: string | null): string | null {
  if (!completedAt) {
    return null;
  }

  const completedAtMs = new Date(completedAt).getTime();

  if (Number.isNaN(completedAtMs)) {
    throw new DealAdminServiceError(
      "Deal completion timestamp is invalid.",
      500,
      "DEAL_INTEGRITY_ERROR",
    );
  }

  return new Date(computeReleaseDeadlineMs(completedAtMs)).toISOString();
}

function toReviewModel(row: AdminDealReviewRow | null): AdminDealReviewModel {
  if (!row) {
    throw new DealAdminServiceError("Deal not found.", 404, "DEAL_NOT_FOUND");
  }

  if (row.status !== "Disputed") {
    throw new DealAdminServiceError(
      "Deal is not in dispute.",
      409,
      "DEAL_NOT_DISPUTED",
    );
  }

  return {
    buyer_address: row.buyer_address,
    completed_at: row.completed_at,
    consultation_link_id: row.consultation_link_id,
    created_at: row.created_at,
    duration_minutes: row.duration_minutes,
    expires_at: row.expires_at,
    id: row.id,
    onchain_deal_id: row.onchain_deal_id,
    price_usdc: row.price_usdc,
    release_deadline_at: computeReleaseDeadline(row.completed_at),
    released_at: row.released_at,
    risk_status: row.risk_status,
    resolution_type: row.resolution_type,
    resolved_at: row.resolved_at,
    resolved_by_wallet: row.resolved_by_wallet,
    resolved_from_status: row.resolved_from_status,
    scheduled_at: row.scheduled_at,
    seller_address: row.seller_address,
    status: row.status,
    timezone: row.timezone,
    title: row.title,
    tx_hash: row.tx_hash,
  };
}

function buildComplianceSummary(input: {
  checks: readonly ComplianceCheckRow[];
  dealId: string;
  riskStatus: DealRiskStatus;
}): ComplianceSummary {
  const providerLatest = new Map<SummaryProviderId, ComplianceCheckRow>();

  for (const provider of SUMMARY_PROVIDER_IDS) {
    const latestCheck = input.checks.find((check) => check.provider === provider);

    if (latestCheck) {
      providerLatest.set(provider, latestCheck);
    }
  }

  return {
    checks_count: input.checks.length,
    deal_id: input.dealId,
    providers: SUMMARY_PROVIDER_IDS.map((provider) => {
      const latestCheck = providerLatest.get(provider);

      return {
        last_checked_at: latestCheck?.checked_at ?? null,
        latest_reason_code: latestCheck?.reason_code ?? null,
        latest_result: latestCheck?.result ?? null,
        provider,
      };
    }),
    risk_status: input.riskStatus,
    wallets: [...new Set(input.checks.map((check) => check.subject_value))].sort(),
  };
}

async function getComplianceChecksForDeal(dealId: string): Promise<ComplianceCheckRow[]> {
  try {
    return await findByDealNewestFirst(dealId);
  } catch (error) {
    if (error instanceof ComplianceChecksRepositoryError) {
      throw new DealAdminServiceError(
        "Failed to load compliance history.",
        500,
        error.code ?? "COMPLIANCE_HISTORY_LOAD_FAILED",
      );
    }

    throw error;
  }
}

async function getAdminDealReviewWithChecks(
  input: DealRouteParams,
): Promise<{
  checks: ComplianceCheckRow[];
  review: AdminDealReviewDetailsModel;
}> {
  let reviewRow: AdminDealReviewRow | null;

  try {
    reviewRow = await getAdminDealReviewRowById(input.dealId);
  } catch (error) {
    mapRepositoryError(error);
  }

  const review = toReviewModel(reviewRow);
  const checks = await getComplianceChecksForDeal(review.id);

  return {
    checks,
    review: {
      ...review,
      compliance_summary: buildComplianceSummary({
        checks,
        dealId: review.id,
        riskStatus: review.risk_status,
      }),
    },
  };
}

function toResolvedReviewModel(row: AdminDealReviewRow): AdminResolvedDealReviewModel {
  if (row.status !== "Released" && row.status !== "Refunded") {
    throw new DealAdminServiceError(
      "Deal is not resolved.",
      409,
      "DEAL_NOT_RESOLVED",
    );
  }

  return {
    buyer_address: row.buyer_address,
    completed_at: row.completed_at,
    consultation_link_id: row.consultation_link_id,
    created_at: row.created_at,
    duration_minutes: row.duration_minutes,
    expires_at: row.expires_at,
    id: row.id,
    onchain_deal_id: row.onchain_deal_id,
    price_usdc: row.price_usdc,
    released_at: row.released_at,
    resolution_type: row.resolution_type,
    resolved_at: row.resolved_at,
    resolved_by_wallet: row.resolved_by_wallet,
    resolved_from_status: row.resolved_from_status,
    scheduled_at: row.scheduled_at,
    seller_address: row.seller_address,
    status: row.status,
    timezone: row.timezone,
    title: row.title,
    tx_hash: row.tx_hash,
  };
}

function isEconnresetLike(error: unknown): error is Error & { code?: string } {
  const maybeError = error as (Error & { code?: string }) | null;

  return (
    error instanceof Error &&
    (error.message.includes("ECONNRESET") || maybeError?.code === "ECONNRESET")
  );
}

function mapRepositoryError(error: unknown): never {
  if (error instanceof DealsRepositoryError) {
    throw new DealAdminServiceError(
      "Failed to load deal.",
      500,
      error.code ?? "DEAL_LOAD_FAILED",
    );
  }

  if (error instanceof AdminResolutionIntentsRepositoryError) {
    throw new DealAdminServiceError(
      "Failed to prepare admin resolution.",
      500,
      error.code ?? "ADMIN_RESOLUTION_INTENT_FAILED",
    );
  }

  if (error instanceof PayoutExecutionGrantsRepositoryError) {
    throw new DealAdminServiceError(
      "Failed to manage payout authorization.",
      500,
      error.code ?? "PAYOUT_GRANT_FAILED",
    );
  }

  if (isEconnresetLike(error)) {
    console.warn("Supabase cold start detected (ECONNRESET)", {
      code: error.code ?? "ECONNRESET",
      operation: "deals-admin",
    });
  }

  throw error;
}

function logAdminResolveComplianceContext(input: {
  action: "adminResolveRefund" | "adminResolveRelease";
  dealId: string;
  reasonCode: string;
  result: string;
  walletAddress: string;
}) {
  console.warn("Admin resolve compliance context.", {
    action: input.action,
    dealId: input.dealId,
    reasonCode: input.reasonCode,
    result: input.result,
    walletAddress: input.walletAddress,
  });
}

function buildGrantToken(): { token: string; tokenHash: string } {
  const rawToken = randomBytes(32);

  return {
    token: rawToken.toString("hex"),
    tokenHash: createHash("sha256").update(rawToken).digest("hex"),
  };
}

async function issueAdminResolveGrant(
  currentUser: CurrentUserContext,
  dealId: string,
  resolution: AdminResolution,
  now: Date,
): Promise<AdminResolveGrantIssueResult> {
  const { token, tokenHash } = buildGrantToken();
  const expiresAt = new Date(now.getTime() + PAYOUT_GRANT_TTL_MS).toISOString();
  const action =
    resolution === "release" ? "adminResolveRelease" : "adminResolveRefund";

  await createPayoutExecutionGrant({
    action,
    dealId,
    expiresAt,
    issuedByWallet: currentUser.wallet_address,
    issuedToWallet: currentUser.wallet_address,
    resolution,
    tokenHash,
  });

  return {
    action,
    deal_id: dealId,
    expires_at: expiresAt,
    grant_token: token,
    resolution,
  };
}

async function consumeAdminResolveGrant(
  currentUser: CurrentUserContext,
  dealId: string,
  grantToken: string,
  now: Date,
) {
  const rawToken = Buffer.from(grantToken, "hex");

  if (rawToken.length !== 32) {
    throw new DealAdminServiceError(
      "Payout authorization is invalid or expired.",
      409,
      "PAYOUT_GRANT_INVALID",
    );
  }

  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const grant = await consumePayoutExecutionGrant({
    allowedActions: ["adminResolveRelease", "adminResolveRefund"],
    dealId,
    issuedToWallet: currentUser.wallet_address,
    now: now.toISOString(),
    tokenHash,
  });

  if (!grant) {
    throw new DealAdminServiceError(
      "Payout authorization is invalid or expired.",
      409,
      "PAYOUT_GRANT_INVALID",
    );
  }

  return grant;
}

export async function listAdminDisputedDeals(
  pagination?: Partial<ListPagination>,
): Promise<AdminDealReviewModel[]> {
  try {
    const rows = await listDisputedDealReviewRows(pagination);
    return rows.map((row) => toReviewModel(row));
  } catch (error) {
    mapRepositoryError(error);
  }
}

export async function listAdminResolvedDeals(
  pagination?: Partial<ListPagination>,
): Promise<AdminResolvedDealReviewModel[]> {
  try {
    const rows = await listResolvedDealReviewRows(pagination);
    return rows.map((row) => toResolvedReviewModel(row));
  } catch (error) {
    mapRepositoryError(error);
  }
}

export async function getAdminDealReview(
  input: DealRouteParams,
): Promise<AdminDealReviewDetailsModel> {
  const { review } = await getAdminDealReviewWithChecks(input);
  return review;
}

export async function getAdminDealCompliance(
  input: DealRouteParams,
): Promise<AdminDealComplianceModel> {
  const { checks, review } = await getAdminDealReviewWithChecks(input);

  return {
    checks,
    compliance_summary: review.compliance_summary,
    deal_id: review.id,
    risk_status: review.risk_status,
  };
}

export async function prepareAdminResolveForDeal(
  currentUser: CurrentUserContext,
  input: DealRouteParams,
  resolution: AdminResolution,
  now: Date = new Date(),
): Promise<AdminResolveGrantIssueResult> {
  let context;

  try {
    context = await getDealActionContextById(input.dealId);
  } catch (error) {
    mapRepositoryError(error);
  }

  if (!context) {
    throw new DealAdminServiceError("Deal not found.", 404, "DEAL_NOT_FOUND");
  }

  if (context.status !== "Disputed") {
    throw new DealAdminServiceError(
      "Deal is not in dispute.",
      409,
      "DEAL_NOT_DISPUTED",
    );
  }

  try {
    return await issueAdminResolveGrant(currentUser, context.id, resolution, now);
  } catch (error) {
    mapRepositoryError(error);
  }
}

export async function exchangeAdminResolveGrantForDeal(
  currentUser: CurrentUserContext,
  input: DealRouteParams,
  grantToken: string,
  now: Date = new Date(),
): Promise<PreparedAdminResolveResult> {
  let context;

  try {
    context = await getDealActionContextById(input.dealId);
  } catch (error) {
    mapRepositoryError(error);
  }

  if (!context) {
    throw new DealAdminServiceError("Deal not found.", 404, "DEAL_NOT_FOUND");
  }

  if (context.status !== "Disputed") {
    throw new DealAdminServiceError(
      "Deal is not in dispute.",
      409,
      "DEAL_NOT_DISPUTED",
    );
  }

  const screeningContexts = {
    refund: {
      action: "admin_resolve_refund" as const,
      actorWallet: currentUser.wallet_address,
      dealId: context.id,
    },
    release: {
      action: "admin_resolve_release" as const,
      actorWallet: currentUser.wallet_address,
      dealId: context.id,
    },
  };
  const releaseScreeningResult = await screenWalletForDeal(
    context.seller_address,
    screeningContexts.release,
  );
  const refundScreeningResult = await screenWalletForDeal(
    context.buyer_address,
    screeningContexts.refund,
  );

  let grant;

  try {
    grant = await consumeAdminResolveGrant(currentUser, input.dealId, grantToken, now);
  } catch (error) {
    mapRepositoryError(error);
  }

  const resolution = grant.resolution;

  if (!resolution) {
    throw new DealAdminServiceError(
      "Payout authorization is invalid.",
      500,
      "PAYOUT_GRANT_INVALID",
    );
  }

  const screeningContext =
    resolution === "release"
      ? screeningContexts.release
      : screeningContexts.refund;
  const screeningResult =
    resolution === "release"
      ? releaseScreeningResult
      : refundScreeningResult;
  logAdminResolveComplianceContext({
    action: resolution === "release" ? "adminResolveRelease" : "adminResolveRefund",
    dealId: context.id,
    reasonCode: screeningResult.reasonCode,
    result: screeningResult.result,
    walletAddress: screeningResult.walletAddress,
  });

  let contractCall: PreparedDealLifecycleCall;

  try {
    contractCall =
      resolution === "release"
        ? prepareAdminResolveReleaseCall(context.onchain_deal_id)
        : prepareAdminResolveRefundCall(context.onchain_deal_id);
  } catch (error) {
    if (error instanceof ConsultEscrowConfigError) {
      throw new DealAdminServiceError(
        error.message,
        500,
        "CONTRACT_CONFIG_UNAVAILABLE",
      );
    }

    throw error;
  }

  try {
    await createAdminResolutionIntent({
      adminWallet: currentUser.wallet_address,
      dealId: context.id,
      onchainDealId: context.onchain_deal_id,
      resolution,
    });
  } catch (error) {
    mapRepositoryError(error);
  }

  return {
    contract_call: contractCall,
    deal_id: context.id,
    resolution,
  };
}
