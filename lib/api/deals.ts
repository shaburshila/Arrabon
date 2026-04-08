import { ApiError } from "@/lib/api/auth";

async function parseResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export type DealStatus =
  | "ConfirmPending"
  | "Disputed"
  | "Funded"
  | "Refunded"
  | "Released";

// Shape returned by GET /api/deals/:id
export interface DealReadModel {
  buyer_address: string;
  completed_at: string | null;
  consultation_link_id: string;
  id: string;
  onchain_deal_id: string;
  release_deadline_at: string | null;
  scheduled_at: string;
  seller_address: string;
  status: DealStatus;
  tx_hash: string | null;
}

// Contract call shape returned by POST /api/deals/:id/complete|release|dispute
export interface LifecycleContractCall {
  args: { deal_id: string }; // onchain deal id (uint256 as string)
  chain_id: number;
  contract_address: string;
  function_name: "confirmRelease" | "markCompleted" | "openDispute";
}

export interface LifecyclePrepareResult {
  contract_call: LifecycleContractCall;
  deal_id: string; // backend UUID
}

// GET /api/deals/:id — public, no auth required
export async function fetchDeal(id: string): Promise<DealReadModel> {
  const res = await fetch(`/api/deals/${encodeURIComponent(id)}`);
  return parseResponse<DealReadModel>(res);
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
