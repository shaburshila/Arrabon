import type {
  ConsultationLinkRow,
  Database,
  DealResolutionType,
  DealRiskStatus,
  DealRow,
} from "@/lib/db/types";
import { computeReleaseDeadlineMs } from "@/lib/constants/deals";
import { getServerDbClient } from "@/lib/db/server";
import {
  normalizeListPagination,
  type ListPagination,
} from "@/lib/validators/pagination";
import {
  ConsultationLinksRepositoryError,
  getById as getConsultationLinkById,
  getByIds as getConsultationLinksByIds,
} from "@/server/repositories/consultation-links";

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

export interface InsertConfirmedDealAndMaybeConsumeLinkOptions {
  consumeLink: boolean;
}

export interface DealReadViewRow {
  buyer_address: string;
  completed_at: string | null;
  consultation_link_id: string;
  id: string;
  onchain_deal_id: string;
  price_usdc: string;
  risk_status: DealRow["risk_status"];
  resolution_type: DealResolutionType | null;
  resolved_at: string | null;
  resolved_by_wallet: string | null;
  resolved_from_status: DealRow["status"] | null;
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
  id: string;
  onchain_deal_id: string;
  released_at: string | null;
  risk_status: DealRow["risk_status"];
  scheduled_at: string;
  seller_address: string;
  status: DealRow["status"];
}

export interface AdminDealReviewRow {
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
  risk_status: DealRow["risk_status"];
  resolution_type: DealResolutionType | null;
  resolved_at: string | null;
  resolved_by_wallet: string | null;
  resolved_from_status: DealRow["status"] | null;
  scheduled_at: string;
  seller_address: string;
  status: DealRow["status"];
  timezone: string;
  title: string;
  tx_hash: string | null;
}

export interface MyBuyerDealRow {
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
  resolved_from_status: DealRow["status"] | null;
  scheduled_at: string;
  seller_address: string;
  status: DealRow["status"];
  timezone: string;
  title: string;
  tx_hash: string | null;
}

type DealWithConsultationLinkRow = DealRow & {
  consultation_links: ConsultationLinkRow | null;
};

function toUtcIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

async function loadDealWithConsultationLinkById(
  dealId: string,
  errorContext: "read view" | "reveal context" | "action context",
): Promise<DealWithConsultationLinkRow | null> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("deals")
    .select("*, consultation_links(*)")
    .eq("id", dealId)
    .returns<DealWithConsultationLinkRow>()
    .maybeSingle();

  if (error) {
    throw new DealsRepositoryError(
      `Failed to load deal ${errorContext}: ${error.message}`,
      error.code,
    );
  }

  return data;
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

export async function getById(id: string): Promise<DealRow | null> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("deals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new DealsRepositoryError(
      `Failed to load deal by id: ${error.message}`,
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

export async function updateRiskStatusById(
  id: string,
  riskStatus: DealRiskStatus,
): Promise<DealRow> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("deals")
    .update({ risk_status: riskStatus })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new DealsRepositoryError(
      `Failed to update deal risk status: ${error.message}`,
      error.code,
    );
  }

  return data;
}

export async function getDealByTxHash(txHash: string): Promise<DealRow | null> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("deals")
    .select("*")
    .eq("tx_hash", txHash)
    .maybeSingle();

  if (error) {
    throw new DealsRepositoryError(
      `Failed to load deal by tx hash: ${error.message}`,
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

export async function insertConfirmedDealAndMaybeConsumeLink(
  input: InsertConfirmedDealInput,
  options: InsertConfirmedDealAndMaybeConsumeLinkOptions,
): Promise<DealRow> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .rpc("insert_confirmed_deal_and_maybe_consume_link", {
      p_buyer_address: input.buyerAddress,
      p_consultation_link_id: input.consultationLinkId,
      p_consume_link: options.consumeLink,
      p_funded_at: toUtcIsoString(input.fundedAt),
      p_onchain_deal_id: input.onchainDealId,
      p_seller_address: input.sellerAddress,
      p_status: input.status,
      p_tx_hash: input.txHash,
    })
    .returns<DealRow>()
    .single();

  if (error) {
    throw new DealsRepositoryError(
      `Failed to insert confirmed deal and maybe consume link: ${error.message}`,
      error.code,
    );
  }

  return data;
}

export async function getDealReadViewById(
  dealId: string,
): Promise<DealReadViewRow | null> {
  const deal = await loadDealWithConsultationLinkById(dealId, "read view");

  if (!deal) {
    return null;
  }

  const linkedConsultationLink = deal.consultation_links;

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
    id: deal.id,
    onchain_deal_id: deal.onchain_deal_id,
    price_usdc: String(linkedConsultationLink.price_usdc),
    risk_status: deal.risk_status,
    resolution_type: deal.resolution_type,
    resolved_at: deal.resolved_at,
    resolved_by_wallet: deal.resolved_by_wallet,
    resolved_from_status: deal.resolved_from_status,
    scheduled_at: linkedConsultationLink.scheduled_at,
    seller_address: deal.seller_address,
    status: deal.status,
    tx_hash: deal.tx_hash,
  };
}

export async function getDealRevealContextById(
  dealId: string,
): Promise<DealRevealContextRow | null> {
  const deal = await loadDealWithConsultationLinkById(dealId, "reveal context");

  if (!deal) {
    return null;
  }

  const linkedConsultationLink = deal.consultation_links;

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
  const deal = await loadDealWithConsultationLinkById(dealId, "action context");

  if (!deal) {
    return null;
  }

  const linkedConsultationLink = deal.consultation_links;

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
    id: deal.id,
    onchain_deal_id: deal.onchain_deal_id,
    released_at: deal.released_at,
    risk_status: deal.risk_status,
    scheduled_at: linkedConsultationLink.scheduled_at,
    seller_address: deal.seller_address,
    status: deal.status,
  };
}

function toAdminDealReviewRow(
  deal: DealRow,
  linkedConsultationLink: ConsultationLinkRow,
): AdminDealReviewRow {
  const linkSummary = toConsultationLinkDealSummary(linkedConsultationLink);

  return {
    buyer_address: deal.buyer_address,
    completed_at: deal.completed_at,
    consultation_link_id: deal.consultation_link_id,
    created_at: deal.created_at,
    expires_at: linkedConsultationLink.expires_at,
    id: deal.id,
    onchain_deal_id: deal.onchain_deal_id,
    risk_status: deal.risk_status,
    released_at: deal.released_at,
    resolution_type: deal.resolution_type,
    resolved_at: deal.resolved_at,
    resolved_by_wallet: deal.resolved_by_wallet,
    resolved_from_status: deal.resolved_from_status,
    seller_address: deal.seller_address,
    status: deal.status,
    tx_hash: deal.tx_hash,
    ...linkSummary,
  };
}

function toConsultationLinkDealSummary(linkedConsultationLink: ConsultationLinkRow) {
  return {
    duration_minutes: linkedConsultationLink.duration_minutes,
    price_usdc: String(linkedConsultationLink.price_usdc),
    scheduled_at: linkedConsultationLink.scheduled_at,
    timezone: linkedConsultationLink.timezone,
    title: linkedConsultationLink.title,
  };
}

function toMyBuyerDealRow(
  deal: DealRow,
  linkedConsultationLink: ConsultationLinkRow,
): MyBuyerDealRow {
  const linkSummary = toConsultationLinkDealSummary(linkedConsultationLink);

  return {
    buyer_address: deal.buyer_address,
    completed_at: deal.completed_at,
    consultation_link_id: deal.consultation_link_id,
    created_at: deal.created_at,
    description: linkedConsultationLink.description,
    id: deal.id,
    onchain_deal_id: deal.onchain_deal_id,
    released_at: deal.released_at,
    resolution_type: deal.resolution_type,
    resolved_at: deal.resolved_at,
    resolved_from_status: deal.resolved_from_status,
    seller_address: deal.seller_address,
    status: deal.status,
    tx_hash: deal.tx_hash,
    ...linkSummary,
  };
}

async function getConsultationLinksByDealRows(
  deals: readonly DealRow[],
): Promise<Map<string, ConsultationLinkRow>> {
  const linkIds = [...new Set(deals.map((deal) => deal.consultation_link_id))];

  try {
    const links = await getConsultationLinksByIds(linkIds);
    return new Map(links.map((link) => [link.id, link]));
  } catch (error) {
    if (error instanceof ConsultationLinksRepositoryError) {
      throw new DealsRepositoryError(
        `Failed to load consultation links for deals: ${error.message}`,
        error.code,
      );
    }

    throw error;
  }
}

export async function listBuyerDealRows(
  buyerAddress: string,
  pagination?: Partial<ListPagination>,
): Promise<MyBuyerDealRow[]> {
  const { limit, offset } = normalizeListPagination(pagination);
  const db = getServerDbClient().schema("public");
  const { data: deals, error } = await db
    .from("deals")
    .select("*")
    .eq("buyer_address", buyerAddress)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new DealsRepositoryError(
      `Failed to list buyer deals: ${error.message}`,
      error.code,
    );
  }

  const dealRows = deals ?? [];

  if (dealRows.length === 0) {
    return [];
  }

  const linksById = await getConsultationLinksByDealRows(dealRows);

  return dealRows.map((deal) => {
    const linkedConsultationLink = linksById.get(deal.consultation_link_id);

    if (!linkedConsultationLink) {
      throw new DealsRepositoryError(
        `Consultation link ${deal.consultation_link_id} was not found for deal ${deal.id}.`,
        "CONSULTATION_LINK_MISSING",
      );
    }

    return toMyBuyerDealRow(deal, linkedConsultationLink);
  });
}

export async function getAllBuyerDealRows(
  buyerAddress: string,
): Promise<MyBuyerDealRow[]> {
  const db = getServerDbClient().schema("public");
  const { data: deals, error } = await db
    .from("deals")
    .select("*")
    .eq("buyer_address", buyerAddress)
    .order("created_at", { ascending: false });

  if (error) {
    throw new DealsRepositoryError(
      `Failed to list buyer deals: ${error.message}`,
      error.code,
    );
  }

  const dealRows = deals ?? [];

  if (dealRows.length === 0) {
    return [];
  }

  const linksById = await getConsultationLinksByDealRows(dealRows);

  return dealRows.map((deal) => {
    const linkedConsultationLink = linksById.get(deal.consultation_link_id);

    if (!linkedConsultationLink) {
      throw new DealsRepositoryError(
        `Consultation link ${deal.consultation_link_id} was not found for deal ${deal.id}.`,
        "CONSULTATION_LINK_MISSING",
      );
    }

    return toMyBuyerDealRow(deal, linkedConsultationLink);
  });
}

export async function listDisputedDealReviewRows(
  pagination?: Partial<ListPagination>,
): Promise<AdminDealReviewRow[]> {
  const { limit, offset } = normalizeListPagination(pagination);
  const db = getServerDbClient().schema("public");
  const { data: deals, error } = await db
    .from("deals")
    .select("*")
    .eq("status", "Disputed")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new DealsRepositoryError(
      `Failed to list disputed deals: ${error.message}`,
      error.code,
    );
  }

  const dealRows = deals ?? [];

  if (dealRows.length === 0) {
    return [];
  }

  const linksById = await getConsultationLinksByDealRows(dealRows);

  return dealRows.map((deal) => {
    const linkedConsultationLink = linksById.get(deal.consultation_link_id);

    if (!linkedConsultationLink) {
      throw new DealsRepositoryError(
        `Consultation link ${deal.consultation_link_id} was not found for deal ${deal.id}.`,
        "CONSULTATION_LINK_MISSING",
      );
    }

    return toAdminDealReviewRow(deal, linkedConsultationLink);
  });
}

export async function listResolvedDealReviewRows(
  pagination?: Partial<ListPagination>,
): Promise<AdminDealReviewRow[]> {
  const { limit, offset } = normalizeListPagination(pagination);
  const db = getServerDbClient().schema("public");
  const { data: deals, error } = await db
    .from("deals")
    .select("*")
    .in("status", ["Released", "Refunded"])
    .eq("resolved_from_status", "Disputed")
    .order("resolved_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new DealsRepositoryError(
      `Failed to list resolved deals: ${error.message}`,
      error.code,
    );
  }

  const dealRows = deals ?? [];

  if (dealRows.length === 0) {
    return [];
  }

  const linksById = await getConsultationLinksByDealRows(dealRows);

  return dealRows.map((deal) => {
    const linkedConsultationLink = linksById.get(deal.consultation_link_id);

    if (!linkedConsultationLink) {
      throw new DealsRepositoryError(
        `Consultation link ${deal.consultation_link_id} was not found for deal ${deal.id}.`,
        "CONSULTATION_LINK_MISSING",
      );
    }

    return toAdminDealReviewRow(deal, linkedConsultationLink);
  });
}

export async function getAdminDealReviewRowById(
  dealId: string,
): Promise<AdminDealReviewRow | null> {
  const db = getServerDbClient().schema("public");
  const { data: deal, error } = await db
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .maybeSingle();

  if (error) {
    throw new DealsRepositoryError(
      `Failed to load admin deal review row: ${error.message}`,
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

  return toAdminDealReviewRow(deal, linkedConsultationLink);
}

type LifecycleStatePatch = Partial<Pick<
  DealRow,
  | "completed_at"
  | "released_at"
  | "resolution_type"
  | "resolved_at"
  | "resolved_by_wallet"
  | "resolved_from_status"
  | "status"
>>;

async function updateLifecycleStateByOnchainDealId(input: {
  alreadyConvergedStatuses: DealRow["status"][];
  onchainDealId: string;
  patch: LifecycleStatePatch | ((currentDeal: DealRow) => LifecycleStatePatch);
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

  const patch =
    typeof input.patch === "function"
      ? input.patch(currentDeal)
      : input.patch;

  const { data, error } = await db
    .from("deals")
    .update(patch)
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

function resolveReleaseResolutionType(
  deal: DealRow,
  releasedAt: Date,
): DealResolutionType {
  if (deal.status === "Disputed") {
    return "admin_release";
  }

  if (!deal.completed_at) {
    return "buyer_confirmed";
  }

  const completedAtMs = new Date(deal.completed_at).getTime();

  if (Number.isNaN(completedAtMs)) {
    return "buyer_confirmed";
  }

  const releaseDeadlineMs = computeReleaseDeadlineMs(completedAtMs);

  return releasedAt.getTime() > releaseDeadlineMs
    ? "auto_release"
    : "buyer_confirmed";
}

export async function setReleasedByOnchainDealId(
  onchainDealId: string,
  releasedAt: Date,
  resolvedByWallet?: string,
): Promise<DealRow> {
  const releasedAtIso = toUtcIsoString(releasedAt);

  // "Disputed" is included so the indexer can converge admin-resolved disputes
  // (adminResolveRelease emits a Released event from the Disputed state).
  return updateLifecycleStateByOnchainDealId({
    alreadyConvergedStatuses: ["Released"],
    onchainDealId,
    patch: (currentDeal) => ({
      released_at: releasedAtIso,
      resolution_type: resolveReleaseResolutionType(currentDeal, releasedAt),
      resolved_at: releasedAtIso,
      resolved_by_wallet: resolvedByWallet ?? null,
      resolved_from_status: currentDeal.status,
      status: "Released",
    }),
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
  resolvedAt: Date = new Date(),
  resolvedByWallet?: string,
): Promise<DealRow> {
  const resolvedAtIso = toUtcIsoString(resolvedAt);

  return updateLifecycleStateByOnchainDealId({
    alreadyConvergedStatuses: ["Refunded"],
    onchainDealId,
    patch: (currentDeal) => ({
      resolution_type: "admin_refund",
      resolved_at: resolvedAtIso,
      resolved_by_wallet: resolvedByWallet ?? null,
      resolved_from_status: currentDeal.status,
      status: "Refunded",
    }),
    targetStatus: "Refunded",
    validFromStatuses: ["Disputed"],
  });
}
