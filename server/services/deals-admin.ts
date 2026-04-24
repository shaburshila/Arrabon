import "server-only";

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
  DealsRepositoryError,
  getAdminDealReviewRowById,
  getDealActionContextById,
  listDisputedDealReviewRows,
  listResolvedDealReviewRows,
  type AdminDealReviewRow,
} from "@/server/repositories/deals";
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

  if (isEconnresetLike(error)) {
    console.warn("Supabase cold start detected (ECONNRESET)", {
      code: error.code ?? "ECONNRESET",
      operation: "deals-admin",
    });
  }

  throw error;
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
): Promise<AdminDealReviewModel> {
  try {
    return toReviewModel(await getAdminDealReviewRowById(input.dealId));
  } catch (error) {
    mapRepositoryError(error);
  }
}

export async function prepareAdminResolveForDeal(
  currentUser: CurrentUserContext,
  input: DealRouteParams,
  resolution: AdminResolution,
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
