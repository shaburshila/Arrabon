import { ApiError } from "@/lib/api/auth";
import type { AdminComplianceSummary } from "@/lib/api/admin";
import type {
  DealResolutionType,
  DealStatus,
  ListPaginationParams,
} from "@/lib/api/deals";
import type { DealRiskStatus } from "@/lib/db/types";

async function parseResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

function formatListQuery(params?: ListPaginationParams): string {
  if (!params) {
    return "";
  }

  const searchParams = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  });

  return `?${searchParams.toString()}`;
}

export type AdminResolution = "refund" | "release";
export type AdminDealsView = "open" | "resolved";

export interface AdminDealReview {
  buyer_address: string;
  compliance_summary: AdminComplianceSummary;
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
  resolution_type: DealResolutionType | null;
  resolved_at: string | null;
  resolved_by_wallet: string | null;
  resolved_from_status: DealStatus | null;
  scheduled_at: string;
  seller_address: string;
  status: Extract<DealStatus, "Disputed">;
  timezone: string;
  title: string;
  tx_hash: string | null;
}

export interface AdminResolvedDealReview {
  buyer_address: string;
  compliance_summary: AdminComplianceSummary;
  completed_at: string | null;
  consultation_link_id: string;
  created_at: string;
  duration_minutes: number;
  expires_at: string;
  id: string;
  onchain_deal_id: string;
  price_usdc: string;
  released_at: string | null;
  risk_status: DealRiskStatus;
  resolution_type: DealResolutionType | null;
  resolved_at: string | null;
  resolved_by_wallet: string | null;
  resolved_from_status: DealStatus | null;
  scheduled_at: string;
  seller_address: string;
  status: Extract<DealStatus, "Released" | "Refunded">;
  timezone: string;
  title: string;
  tx_hash: string | null;
}

export interface AdminContractCall {
  chain_id: number;
  contract_address: string;
  data: `0x${string}`;
  function_name: "adminResolveRefund" | "adminResolveRelease";
}

export interface AdminResolvePrepareResult {
  contract_call: AdminContractCall;
  deal_id: string;
  resolution: AdminResolution;
}

export interface AdminResolveGrantResult {
  action: "adminResolveRefund" | "adminResolveRelease";
  deal_id: string;
  expires_at: string;
  grant_token: string;
  resolution: AdminResolution;
}

// GET /api/admin/deals — requires SIWE admin session
export async function fetchAdminDisputedDeals(
  params?: ListPaginationParams,
): Promise<AdminDealReview[]> {
  const res = await fetch(`/api/admin/deals${formatListQuery(params)}`);
  return parseResponse<AdminDealReview[]>(res);
}

export async function fetchAdminResolvedDeals(
  params?: ListPaginationParams,
): Promise<AdminResolvedDealReview[]> {
  const query = formatListQuery(params);
  const suffix = query ? `${query}&view=resolved` : "?view=resolved";
  const res = await fetch(`/api/admin/deals${suffix}`);
  return parseResponse<AdminResolvedDealReview[]>(res);
}

// GET /api/admin/deals/:id — requires SIWE admin session
export async function fetchAdminDeal(id: string): Promise<AdminDealReview> {
  const res = await fetch(`/api/admin/deals/${encodeURIComponent(id)}`);
  return parseResponse<AdminDealReview>(res);
}

// POST /api/admin/deals/:id/resolve — requires SIWE admin session
export async function prepareAdminResolve(
  dealId: string,
  resolution: AdminResolution,
): Promise<AdminResolveGrantResult> {
  const res = await fetch(`/api/admin/deals/${encodeURIComponent(dealId)}/resolve`, {
    body: JSON.stringify({ resolution }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  return parseResponse<AdminResolveGrantResult>(res);
}

export async function exchangeAdminResolve(
  dealId: string,
  grantToken: string,
): Promise<AdminResolvePrepareResult> {
  const res = await fetch(`/api/admin/deals/${encodeURIComponent(dealId)}/resolve/execute`, {
    body: JSON.stringify({ grant_token: grantToken }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  return parseResponse<AdminResolvePrepareResult>(res);
}
