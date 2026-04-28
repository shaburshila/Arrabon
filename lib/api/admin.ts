import { ApiError } from "@/lib/api/auth";
import type { ListPaginationParams } from "@/lib/api/deals";
import type {
  ComplianceCheckResult,
  ComplianceProviderId,
  DealRiskStatus,
} from "@/lib/db/types";

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

export interface AdminComplianceSummaryProvider {
  last_checked_at: string | null;
  latest_reason_code: string | null;
  latest_result: ComplianceCheckResult | null;
  provider: ComplianceProviderId;
}

export interface AdminComplianceSummary {
  checks_count: number;
  deal_id: string;
  providers: AdminComplianceSummaryProvider[];
  risk_status: DealRiskStatus;
  wallets: string[];
}

export interface AdminComplianceCheck {
  actor_wallet: string | null;
  checked_at: string;
  deal_id: string | null;
  id: string;
  provider: ComplianceProviderId;
  raw_summary: Record<string, unknown>;
  reason_code: string;
  result: ComplianceCheckResult;
  subject_type: "wallet";
  subject_value: string;
}

export interface AdminDealCompliance {
  checks: AdminComplianceCheck[];
  compliance_summary: AdminComplianceSummary;
  deal_id: string;
  risk_status: DealRiskStatus;
}

export type AdminDenylistReason = "abuse" | "fraud" | "other" | "sanctions";

export interface AdminDenylistEntry {
  added_at: string;
  added_by_wallet: string;
  notes: string | null;
  reason: AdminDenylistReason;
  wallet: string;
}

export interface AddAdminDenylistInput {
  notes: string | null;
  reason: AdminDenylistReason;
  wallet: string;
}

export interface RemoveAdminDenylistInput {
  comment: string;
}

export interface RemovedAdminDenylistEntry {
  removed_wallet: string;
}

export async function fetchAdminDealCompliance(id: string): Promise<AdminDealCompliance> {
  const res = await fetch(`/api/admin/deals/${encodeURIComponent(id)}/compliance`);
  return parseResponse<AdminDealCompliance>(res);
}

export async function fetchAdminDenylist(
  params?: ListPaginationParams,
): Promise<AdminDenylistEntry[]> {
  const res = await fetch(`/api/admin/denylist${formatListQuery(params)}`);
  return parseResponse<AdminDenylistEntry[]>(res);
}

export async function addAdminDenylistEntry(
  input: AddAdminDenylistInput,
): Promise<AdminDenylistEntry> {
  const res = await fetch("/api/admin/denylist", {
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  return parseResponse<AdminDenylistEntry>(res);
}

export async function removeAdminDenylistEntry(
  wallet: string,
  input: RemoveAdminDenylistInput,
): Promise<RemovedAdminDenylistEntry> {
  const res = await fetch(`/api/admin/denylist/${encodeURIComponent(wallet)}`, {
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
    method: "DELETE",
  });
  return parseResponse<RemovedAdminDenylistEntry>(res);
}
