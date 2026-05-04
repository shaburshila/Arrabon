import { ApiError } from "@/lib/api/auth";
import type { Hex } from "viem";
import type { DealResolutionType, DealStatus } from "@/lib/api/deals";

async function parseResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export interface ListPaginationParams {
  limit: number;
  offset: number;
}

export type MyLinksFilter =
  | "all"
  | "available"
  | "upcoming"
  | "awaiting_buyer"
  | "disputed"
  | "closed"
  | "inactive";

export interface FetchMyLinksParams extends Partial<ListPaginationParams> {
  filter?: MyLinksFilter;
}

function formatListQuery(params?: FetchMyLinksParams): string {
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

// Shape returned by GET /api/links/:id
export interface PublicLink {
  deal_id: string | null;
  description: string;
  duration_minutes: number;
  expires_at: string;
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
  meeting_url: string;
  price_usdc: string;
  scheduled_at: string;
  timezone: string;
  title: string;
}

// Contract call args from funding prepare
export interface FundingContractCall {
  chain_id: number;
  contract_address: string;
  data: Hex;
  function_name: "createAndFundDeal";
}

// Shape returned by POST /api/links/:id/funding/prepare
export interface FundingPrepareResult {
  approval_amount: string;
  buyer_address: string;
  consultation_link_id: string;
  contract_call: FundingContractCall;
  link_hash: string;
  schedule: {
    duration_minutes: number;
    scheduled_at: string;
  };
  seller_address: string;
}

export interface FundingSyncSummary {
  alreadyProcessed: number;
  fromBlock: string;
  processed: number;
  skipped: number;
  toBlock: string;
}

export type FundingSyncResult =
  | {
    ok: true;
    status: "pending_confirmations" | "success";
    summary: FundingSyncSummary;
  }
  | {
    code: string;
    error: string;
    ok: false;
    status: "fatal" | "retryable";
  };

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

// Shape returned by GET /api/links (my links)
export interface MyLink {
  deal_id: string | null;
  deal_resolution_type: DealResolutionType | null;
  deal_resolved_at: string | null;
  deal_resolved_from_status: DealStatus | null;
  deal_status: DealStatus | null;
  description: string;
  duration_minutes: number;
  expires_at: string;
  id: string;
  price_usdc: string;
  scheduled_at: string;
  share_url: string;
  status: "Open" | "Expired" | "Cancelled" | "Consumed" | "Draft";
  timezone: string;
  title: string;
}

// GET /api/links — requires SIWE session
export async function fetchMyLinks(params?: FetchMyLinksParams): Promise<MyLink[]> {
  const res = await fetch(`/api/links${formatListQuery(params)}`);
  return parseResponse<MyLink[]>(res);
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

// POST /api/links/:id/funding/sync — requires SIWE session
export async function triggerFundingSync(
  linkId: string,
  txHash?: Hex,
): Promise<FundingSyncResult> {
  const res = await fetch(`/api/links/${encodeURIComponent(linkId)}/funding/sync`, {
    body: JSON.stringify(
      txHash !== undefined ? { tx_hash: txHash } : {},
    ),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const body = await res.json().catch(() => null);

  if (
    body &&
    typeof body === "object" &&
    "ok" in body &&
    "status" in body
  ) {
    return body as FundingSyncResult;
  }

  if (!res.ok) {
    throw new ApiError(res.status, body);
  }

  return {
    code: "INVALID_SYNC_RESPONSE",
    error: "Invalid funding sync response.",
    ok: false,
    status: "retryable",
  };
}
