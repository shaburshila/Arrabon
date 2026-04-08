import { ApiError } from "@/lib/api/auth";

async function parseResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

// Shape returned by GET /api/links/:id
export interface PublicLink {
  deal_id: string | null;
  description: string;
  duration_minutes: number;
  expires_at: string;
  grace_period_minutes: number;
  id: string;
  meeting_url_revealed: false;
  price_usdc: string;
  scheduled_at: string;
  seller_address: string;
  status: "Consumed" | "Open";
  timezone: string;
  title: string;
}

// Unavailable link (410 response carries status in body)
export interface UnavailableLink {
  error: string;
  status: "Cancelled" | "Expired";
}

// Shape returned by POST /api/links
export interface CreatedLink {
  id: string;
  link_hash: string;
  share_url: string;
  status: "Open";
}

// Input for POST /api/links
export interface CreateLinkInput {
  description: string;
  duration_minutes: number;
  expires_at: string;
  grace_period_minutes: number;
  meeting_url: string;
  price_usdc: string;
  scheduled_at: string;
  timezone: string;
  title: string;
}

// Contract call args from funding prepare
export interface FundingContractCall {
  args: {
    buyer: string;
    duration_minutes: string;
    grace_period_minutes: string;
    link_hash: string;
    price: string;
    scheduled_at: string;
    seller: string;
  };
  chain_id: number;
  contract_address: string;
  function_name: "createAndFundDeal";
}

// Shape returned by POST /api/links/:id/funding/prepare
export interface FundingPrepareResult {
  buyer_address: string;
  consultation_link_id: string;
  contract_call: FundingContractCall;
  link_hash: string;
  schedule: {
    duration_minutes: number;
    grace_period_minutes: number;
    scheduled_at: string;
  };
  seller_address: string;
}

// GET /api/links/:id — public, no auth required
// Returns PublicLink on success, throws ApiError on 404/410/5xx
export async function fetchLink(id: string): Promise<PublicLink> {
  const res = await fetch(`/api/links/${encodeURIComponent(id)}`);
  return parseResponse<PublicLink>(res);
}

// POST /api/links — requires SIWE session
export async function createLink(input: CreateLinkInput): Promise<CreatedLink> {
  const res = await fetch("/api/links", {
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  return parseResponse<CreatedLink>(res);
}

// POST /api/links/:id/funding/prepare — requires SIWE session
export async function prepareFunding(linkId: string): Promise<FundingPrepareResult> {
  const res = await fetch(`/api/links/${encodeURIComponent(linkId)}/funding/prepare`, {
    body: "{}",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  return parseResponse<FundingPrepareResult>(res);
}
