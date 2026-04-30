import { ApiError } from "@/lib/api/auth";

async function parseResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export interface ListPaginationParams {
  limit: number;
  offset: number;
}

export type MyDealsFilter =
  | "all"
  | "upcoming"
  | "needs_action"
  | "disputed"
  | "resolved";

export interface FetchMyDealsParams extends Partial<ListPaginationParams> {
  filter?: MyDealsFilter;
}

function formatListQuery(params?: FetchMyDealsParams): string {
  if (!params || Object.keys(params).length === 0) {
    return "";
  }

  const searchParams = new URLSearchParams();

  if (params.filter) {
    searchParams.set("filter", params.filter);
  }
  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }
  if (params.offset !== undefined) {
    searchParams.set("offset", String(params.offset));
  }

  return `?${searchParams.toString()}`;
}

export type DealStatus =
  | "ConfirmPending"
  | "Disputed"
  | "Funded"
  | "Refunded"
  | "Released";

export type DealResolutionType =
  | "admin_refund"
  | "admin_release"
  | "auto_release"
  | "buyer_confirmed";

const POLLABLE_DEAL_STATUSES: ReadonlySet<DealStatus> = new Set([
  "ConfirmPending",
  "Disputed",
  "Funded",
]);

export function isDealStatusPollable(status: DealStatus): boolean {
  return POLLABLE_DEAL_STATUSES.has(status);
}

// Shape returned by GET /api/deals/:id
export interface DealReadModel {
  buyer_address: string;
  completed_at: string | null;
  consultation_link_id: string;
  id: string;
  onchain_deal_id: string;
  price_usdc: string;
  release_deadline_at: string | null;
  resolution_type: DealResolutionType | null;
  resolved_at: string | null;
  resolved_by_wallet: string | null;
  resolved_from_status: DealStatus | null;
  scheduled_at: string;
  seller_address: string;
  status: DealStatus;
  tx_hash: string | null;
}

// Shape returned by GET /api/me/deals
export interface MyDeal {
  buyer_address: string;
  completed_at: string | null;
  consultation_link_id: string;
  created_at: string;
  description: string;
  duration_minutes: number;
  id: string;
  onchain_deal_id: string;
  price_usdc: string;
  released_at: string | null;
  resolution_type: DealResolutionType | null;
  resolved_at: string | null;
  resolved_from_status: DealStatus | null;
  scheduled_at: string;
  seller_address: string;
  status: DealStatus;
  timezone: string;
  title: string;
  tx_hash: string | null;
}

// Contract call shape returned by lifecycle prepare endpoints.
export interface LifecycleContractCall {
  args: { deal_id: string }; // onchain deal id (uint256 as string)
  chain_id: number;
  contract_address: string;
  function_name: "autoRelease" | "confirmRelease" | "markCompleted" | "openDispute";
}

export interface LifecyclePrepareResult {
  contract_call: LifecycleContractCall;
  deal_id: string; // backend UUID
}

// GET /api/deals/:id — requires SIWE session for a participant or admin
export async function fetchDeal(id: string): Promise<DealReadModel> {
  const res = await fetch(`/api/deals/${encodeURIComponent(id)}`);
  return parseResponse<DealReadModel>(res);
}

// GET /api/me/deals — requires SIWE session, returns deals where current wallet is buyer
export async function fetchMyDeals(params?: FetchMyDealsParams): Promise<MyDeal[]> {
  const res = await fetch(`/api/me/deals${formatListQuery(params)}`);
  return parseResponse<MyDeal[]>(res);
}

// GET /api/deals/:id/meeting-url — requires SIWE session
export async function fetchMeetingUrl(dealId: string): Promise<string> {
  const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/meeting-url`);
  const body = await parseResponse<{ meeting_url: string }>(res);
  return body.meeting_url;
}

// POST /api/deals/:id/complete — requires SIWE session (seller)
export async function prepareComplete(dealId: string): Promise<LifecyclePrepareResult> {
  const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/complete`, {
    body: "{}",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  return parseResponse<LifecyclePrepareResult>(res);
}

// POST /api/deals/:id/release — requires SIWE session (buyer)
export async function prepareRelease(dealId: string): Promise<LifecyclePrepareResult> {
  const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/release`, {
    body: "{}",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  return parseResponse<LifecyclePrepareResult>(res);
}

// POST /api/deals/:id/dispute — requires SIWE session (buyer)
export async function prepareDispute(dealId: string): Promise<LifecyclePrepareResult> {
  const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/dispute`, {
    body: "{}",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  return parseResponse<LifecyclePrepareResult>(res);
}

// POST /api/deals/:id/auto-release — requires SIWE session for a participant or admin
export async function prepareAutoRelease(dealId: string): Promise<LifecyclePrepareResult> {
  const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/auto-release`, {
    body: "{}",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  return parseResponse<LifecyclePrepareResult>(res);
}
