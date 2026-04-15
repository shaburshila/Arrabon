import type {
  ConsultationLinkRow,
  Database,
  DealRow,
} from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";
import { getById as getConsultationLinkById } from "@/server/repositories/consultation-links";

type DealsTable = Database["public"]["Tables"]["deals"];
type DealInsert = DealsTable["Insert"];

export class DealsRepositoryError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "DealsRepositoryError";
    this.code = code;
  }
}

export interface InsertConfirmedDealInput {
  buyerAddress: string;
  consultationLinkId: string;
  fundedAt: Date | null;
  onchainDealId: string;
  sellerAddress: string;
  status: DealRow["status"];
  txHash: string | null;
}

export interface DealReadViewRow {
  buyer_address: string;
  completed_at: string | null;
  consultation_link_id: string;
  duration_minutes: number;
  grace_period_minutes: number;
  id: string;
  onchain_deal_id: string;
  price_usdc: string;
  scheduled_at: string;
  seller_address: string;
  status: DealRow["status"];
  tx_hash: string | null;
}

export interface DealRevealContextRow {
  buyer_address: string;
  consultation_link_id: string;
  consultation_link_status: ConsultationLinkRow["status"];
  deal_id: string;
  seller_address: string;
  status: DealRow["status"];
  expert_address: string;
  meeting_url_encrypted: string;
}

export interface DealActionContextRow {
  buyer_address: string;
  completed_at: string | null;
  consultation_link_id: string;
  duration_minutes: number;
  grace_period_minutes: number;
  id: string;
  onchain_deal_id: string;
  released_at: string | null;
  scheduled_at: string;
  seller_address: string;
  status: DealRow["status"];
}

function toUtcIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export async function getByConsultationLinkId(
  consultationLinkId: string,
): Promise<DealRow | null> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("deals")
    .select("*")
    .eq("consultation_link_id", consultationLinkId)
    .maybeSingle();

  if (error) {
    throw new DealsRepositoryError(
      `Failed to load deal by consultation link id: ${error.message}`,
      error.code,
    );
  }

  return data;
}

export async function getByConsultationLinkIds(
  consultationLinkIds: readonly string[],
): Promise<DealRow[]> {
  if (consultationLinkIds.length === 0) {
    return [];
  }

  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("deals")
    .select("*")
    .in("consultation_link_id", [...consultationLinkIds]);

  if (error) {
    throw new DealsRepositoryError(
      `Failed to load deals by consultation link ids: ${error.message}`,
      error.code,
    );
  }

  return data ?? [];
}

export async function getByOnchainDealId(
  onchainDealId: string,
): Promise<DealRow | null> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("deals")
    .select("*")
    .eq("onchain_deal_id", onchainDealId)
    .maybeSingle();

  if (error) {
    throw new DealsRepositoryError(
      `Failed to load deal by onchain deal id: ${error.message}`,
      error.code,
    );
  }

  return data;
}

export async function insertConfirmedDeal(
  input: InsertConfirmedDealInput,
): Promise<DealRow> {
  const db = getServerDbClient().schema("public");
  const payload: DealInsert = {
    buyer_address: input.buyerAddress,
    consultation_link_id: input.consultationLinkId,
    funded_at: toUtcIsoString(input.fundedAt),
    onchain_deal_id: input.onchainDealId,
    seller_address: input.sellerAddress,
    status: input.status,
    tx_hash: input.txHash,
  };

  const { data, error } = await db
    .from("deals")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new DealsRepositoryError(
      `Failed to insert confirmed deal: ${error.message}`,
      error.code,
    );
  }

  return data;
}

export async function getDealReadViewById(
  dealId: string,
): Promise<DealReadViewRow | null> {
  const db = getServerDbClient().schema("public");
  const { data: deal, error } = await db
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .maybeSingle();

  if (error) {
    throw new DealsRepositoryError(
      `Failed to load deal read view: ${error.message}`,
      error.code,
    );
  }

  if (!deal) {
    return null;
  }

  const linkedConsultationLink = await getConsultationLinkById(deal.consultation_link_id);

  if (!linkedConsultationLink) {
    throw new DealsRepositoryError(
      `Consultation link ${deal.consultation_link_id} was not found for deal ${deal.id}.`,
      "CONSULTATION_LINK_MISSING",
    );
  }

  return {
    buyer_address: deal.buyer_address,
    completed_at: deal.completed_at,
    consultation_link_id: deal.consultation_link_id,
    duration_minutes: linkedConsultationLink.duration_minutes,
    grace_period_minutes: linkedConsultationLink.grace_period_minutes,
    id: deal.id,
    onchain_deal_id: deal.onchain_deal_id,
    price_usdc: String(linkedConsultationLink.price_usdc),
    scheduled_at: linkedConsultationLink.scheduled_at,
    seller_address: deal.seller_address,
    status: deal.status,
    tx_hash: deal.tx_hash,
  };
}

export async function getDealRevealContextById(
  dealId: string,
): Promise<DealRevealContextRow | null> {
  const db = getServerDbClient().schema("public");
  const { data: deal, error } = await db
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .maybeSingle();

  if (error) {
    throw new DealsRepositoryError(
      `Failed to load deal reveal context: ${error.message}`,
      error.code,
    );
  }

  if (!deal) {
    return null;
  }

  const linkedConsultationLink = await getConsultationLinkById(deal.consultation_link_id);

  if (!linkedConsultationLink) {
    throw new DealsRepositoryError(
      `Consultation link ${deal.consultation_link_id} was not found for deal ${deal.id}.`,
      "CONSULTATION_LINK_MISSING",
    );
  }

  return {
    buyer_address: deal.buyer_address,
    consultation_link_id: deal.consultation_link_id,
    consultation_link_status: linkedConsultationLink.status,
    deal_id: deal.id,
    expert_address: linkedConsultationLink.expert_address,
    meeting_url_encrypted: linkedConsultationLink.meeting_url_encrypted,
    seller_address: deal.seller_address,
    status: deal.status,
  };
}

export async function getDealActionContextById(
  dealId: string,
): Promise<DealActionContextRow | null> {
  const db = getServerDbClient().schema("public");
  const { data: deal, error } = await db
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .maybeSingle();

  if (error) {
    throw new DealsRepositoryError(
      `Failed to load deal action context: ${error.message}`,
      error.code,
    );
  }

  if (!deal) {
    return null;
  }

  const linkedConsultationLink = await getConsultationLinkById(deal.consultation_link_id);

  if (!linkedConsultationLink) {
    throw new DealsRepositoryError(
      `Consultation link ${deal.consultation_link_id} was not found for deal ${deal.id}.`,
      "CONSULTATION_LINK_MISSING",
    );
  }

  return {
    buyer_address: deal.buyer_address,
    completed_at: deal.completed_at,
    consultation_link_id: deal.consultation_link_id,
    duration_minutes: linkedConsultationLink.duration_minutes,
    grace_period_minutes: linkedConsultationLink.grace_period_minutes,
    id: deal.id,
    onchain_deal_id: deal.onchain_deal_id,
    released_at: deal.released_at,
    scheduled_at: linkedConsultationLink.scheduled_at,
    seller_address: deal.seller_address,
    status: deal.status,
  };
}

async function updateLifecycleStateByOnchainDealId(input: {
  alreadyConvergedStatuses: DealRow["status"][];
  onchainDealId: string;
  patch: Partial<Pick<DealRow, "completed_at" | "released_at" | "status">>;
  requiredTimestampField?: "completed_at" | "released_at";
  targetStatus: DealRow["status"];
  validFromStatuses: DealRow["status"][];
}): Promise<DealRow> {
  const db = getServerDbClient().schema("public");
  const currentDeal = await getByOnchainDealId(input.onchainDealId);

  if (!currentDeal) {
    throw new DealsRepositoryError(
      `Deal not found for onchain deal id: ${input.onchainDealId}`,
      "DEAL_NOT_FOUND",
    );
  }

  if (currentDeal.status === input.targetStatus) {
    if (!input.requiredTimestampField || currentDeal[input.requiredTimestampField]) {
      return currentDeal;
    }
  }

  if (input.alreadyConvergedStatuses.includes(currentDeal.status)) {
    if (!input.requiredTimestampField || currentDeal[input.requiredTimestampField]) {
      return currentDeal;
    }
  }

  if (!input.validFromStatuses.includes(currentDeal.status)) {
    throw new DealsRepositoryError(
      `Invalid deal status transition for ${input.onchainDealId}: ${currentDeal.status} -> ${input.targetStatus}.`,
      "INVALID_DEAL_STATUS_TRANSITION",
    );
  }

  const { data, error } = await db
    .from("deals")
    .update(input.patch)
    .eq("id", currentDeal.id)
    .eq("status", currentDeal.status)
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      const refreshedDeal = await getByOnchainDealId(input.onchainDealId);

      // Another retry or worker may have already applied the same confirmed event between read and update.
      if (
        refreshedDeal &&
        (refreshedDeal.status === input.targetStatus ||
          input.alreadyConvergedStatuses.includes(refreshedDeal.status)) &&
        (!input.requiredTimestampField || refreshedDeal[input.requiredTimestampField])
      ) {
        return refreshedDeal;
      }
    }

    throw new DealsRepositoryError(
      `Failed to update deal lifecycle state: ${error.message}`,
      error.code,
    );
  }

  return data;
}

export async function setConfirmPendingByOnchainDealId(
  onchainDealId: string,
  completedAt: Date,
): Promise<DealRow> {
  return updateLifecycleStateByOnchainDealId({
    alreadyConvergedStatuses: ["ConfirmPending", "Released", "Disputed"],
    onchainDealId,
    patch: {
      completed_at: toUtcIsoString(completedAt),
      status: "ConfirmPending",
    },
    requiredTimestampField: "completed_at",
    targetStatus: "ConfirmPending",
    validFromStatuses: ["Funded"],
  });
}

export async function setReleasedByOnchainDealId(
  onchainDealId: string,
  releasedAt: Date,
): Promise<DealRow> {
  // "Disputed" is included so the indexer can converge admin-resolved disputes
  // (adminResolveRelease emits a Released event from the Disputed state).
  return updateLifecycleStateByOnchainDealId({
    alreadyConvergedStatuses: ["Released"],
    onchainDealId,
    patch: {
      released_at: toUtcIsoString(releasedAt),
      status: "Released",
    },
    requiredTimestampField: "released_at",
    targetStatus: "Released",
    validFromStatuses: ["ConfirmPending", "Disputed"],
  });
}

export async function setDisputedByOnchainDealId(
  onchainDealId: string,
): Promise<DealRow> {
  return updateLifecycleStateByOnchainDealId({
    alreadyConvergedStatuses: ["Disputed"],
    onchainDealId,
    patch: {
      status: "Disputed",
    },
    targetStatus: "Disputed",
    validFromStatuses: ["ConfirmPending", "Funded"],
  });
}

export async function setRefundedByOnchainDealId(
  onchainDealId: string,
): Promise<DealRow> {
  return updateLifecycleStateByOnchainDealId({
    alreadyConvergedStatuses: ["Refunded"],
    onchainDealId,
    patch: {
      status: "Refunded",
    },
    targetStatus: "Refunded",
    validFromStatuses: ["Disputed"],
  });
}
