import type {
  DealPayoutBlockRequestInsert,
  DealPayoutBlockRequestRow,
  DealPayoutBlockRequestUpdate,
} from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";

export class DealPayoutBlockRequestsRepositoryError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "DealPayoutBlockRequestsRepositoryError";
    this.code = code;
  }
}

export interface EnqueueDenylistDealPayoutBlockRequestInput {
  dealId: string;
  onchainDealId: string;
}

const DENYLIST_SOURCE = "denylist_add" as const;
const PENDING_STATUS = "pending" as const;

export async function enqueueDenylistDealPayoutBlockRequests(
  requests: readonly EnqueueDenylistDealPayoutBlockRequestInput[],
): Promise<void> {
  if (requests.length === 0) {
    return;
  }

  const db = getServerDbClient().schema("public");
  const dealIds = [...new Set(requests.map((request) => request.dealId))];

  const { data: existingPending, error: existingError } = await db
    .from("deal_payout_block_requests")
    .select("deal_id")
    .in("deal_id", dealIds)
    .eq("blocked", true)
    .eq("source", DENYLIST_SOURCE)
    .eq("status", PENDING_STATUS);

  if (existingError) {
    throw new DealPayoutBlockRequestsRepositoryError(
      `Failed to load pending payout block requests: ${existingError.message}`,
      existingError.code,
    );
  }

  const pendingDealIds = new Set((existingPending ?? []).map((row) => row.deal_id as string));
  const payload: DealPayoutBlockRequestInsert[] = requests
    .filter((request) => !pendingDealIds.has(request.dealId))
    .map((request) => ({
      blocked: true,
      deal_id: request.dealId,
      onchain_deal_id: request.onchainDealId,
      source: DENYLIST_SOURCE,
      status: PENDING_STATUS,
    }));

  if (payload.length === 0) {
    return;
  }

  const { error } = await db
    .from("deal_payout_block_requests")
    .insert(payload);

  if (error) {
    // Partial unique index `idx_deal_payout_block_requests_pending_unique`
    // closes the race where two admins enqueue the same pending hold concurrently.
    // Supabase's upsert path is not a good fit here because the uniqueness rule is partial,
    // so we treat 23505 as an expected idempotent outcome.
    if (error.code === "23505") {
      return;
    }

    throw new DealPayoutBlockRequestsRepositoryError(
      `Failed to enqueue payout block requests: ${error.message}`,
      error.code,
    );
  }
}

export async function listPendingDenylistDealPayoutBlockRequests(): Promise<DealPayoutBlockRequestRow[]> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("deal_payout_block_requests")
    .select("*")
    .eq("blocked", true)
    .eq("source", DENYLIST_SOURCE)
    .eq("status", PENDING_STATUS)
    .order("created_at", { ascending: true });

  if (error) {
    throw new DealPayoutBlockRequestsRepositoryError(
      `Failed to list pending payout block requests: ${error.message}`,
      error.code,
    );
  }

  return data ?? [];
}

async function updateDealPayoutBlockRequest(
  requestId: string,
  update: DealPayoutBlockRequestUpdate,
): Promise<void> {
  const db = getServerDbClient().schema("public");
  const { error } = await db
    .from("deal_payout_block_requests")
    .update(update)
    .eq("id", requestId);

  if (error) {
    throw new DealPayoutBlockRequestsRepositoryError(
      `Failed to update payout block request: ${error.message}`,
      error.code,
    );
  }
}

export async function markDealPayoutBlockRequestApplied(requestId: string): Promise<void> {
  await updateDealPayoutBlockRequest(requestId, {
    applied_at: new Date().toISOString(),
    last_error_code: null,
    last_error_message: null,
    status: "applied",
  });
}

export async function markDealPayoutBlockRequestFailure(
  requestId: string,
  code: string,
  message: string,
): Promise<void> {
  await updateDealPayoutBlockRequest(requestId, {
    last_error_code: code,
    last_error_message: message,
    status: "pending",
  });
}

export async function markDealPayoutBlockRequestNonActionable(
  requestId: string,
  code: string,
  message: string,
): Promise<void> {
  await updateDealPayoutBlockRequest(requestId, {
    last_error_code: code,
    last_error_message: message,
    status: "non_actionable",
  });
}
