import type {
  DealRiskRecomputeRequestInsert,
  DealRiskRecomputeRequestRow,
  DealRiskRecomputeRequestSource,
  DealRiskRecomputeRequestUpdate,
} from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";

export class DealRiskRecomputeRequestsRepositoryError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "DealRiskRecomputeRequestsRepositoryError";
    this.code = code;
  }
}

const PENDING_STATUS = "pending" as const;

export async function enqueueDealRiskRecomputeRequest(input: {
  dealId: string;
  source: DealRiskRecomputeRequestSource;
}): Promise<void> {
  const db = getServerDbClient().schema("public");
  const payload: DealRiskRecomputeRequestInsert = {
    deal_id: input.dealId,
    source: input.source,
    status: PENDING_STATUS,
  };

  const { error } = await db
    .from("deal_risk_recompute_requests")
    .insert(payload);

  if (error) {
    if (error.code === "23505") {
      return;
    }

    throw new DealRiskRecomputeRequestsRepositoryError(
      `Failed to enqueue deal risk recompute request: ${error.message}`,
      error.code,
    );
  }
}

export async function listPendingDealRiskRecomputeRequests(): Promise<DealRiskRecomputeRequestRow[]> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("deal_risk_recompute_requests")
    .select("*")
    .eq("status", PENDING_STATUS)
    .order("created_at", { ascending: true });

  if (error) {
    throw new DealRiskRecomputeRequestsRepositoryError(
      `Failed to list pending deal risk recompute requests: ${error.message}`,
      error.code,
    );
  }

  return data ?? [];
}

async function updateDealRiskRecomputeRequestById(
  requestId: string,
  update: DealRiskRecomputeRequestUpdate,
): Promise<void> {
  const db = getServerDbClient().schema("public");
  const { error } = await db
    .from("deal_risk_recompute_requests")
    .update(update)
    .eq("id", requestId);

  if (error) {
    throw new DealRiskRecomputeRequestsRepositoryError(
      `Failed to update deal risk recompute request: ${error.message}`,
      error.code,
    );
  }
}

export async function markDealRiskRecomputeRequestApplied(
  requestId: string,
): Promise<void> {
  await updateDealRiskRecomputeRequestById(requestId, {
    applied_at: new Date().toISOString(),
    last_error_code: null,
    last_error_message: null,
    status: "applied",
  });
}

export async function markDealRiskRecomputeRequestAppliedByDealSource(input: {
  dealId: string;
  source: DealRiskRecomputeRequestSource;
}): Promise<void> {
  const db = getServerDbClient().schema("public");
  const { error } = await db
    .from("deal_risk_recompute_requests")
    .update({
      applied_at: new Date().toISOString(),
      last_error_code: null,
      last_error_message: null,
      status: "applied",
    })
    .eq("deal_id", input.dealId)
    .eq("source", input.source)
    .eq("status", PENDING_STATUS);

  if (error) {
    throw new DealRiskRecomputeRequestsRepositoryError(
      `Failed to mark deal risk recompute request applied: ${error.message}`,
      error.code,
    );
  }
}

export async function markDealRiskRecomputeRequestFailure(
  requestId: string,
  code: string,
  message: string,
): Promise<void> {
  await updateDealRiskRecomputeRequestById(requestId, {
    last_error_code: code,
    last_error_message: message,
    status: PENDING_STATUS,
  });
}
