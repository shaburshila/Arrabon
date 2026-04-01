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
  id: string;
  onchain_deal_id: string;
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
    id: deal.id,
    onchain_deal_id: deal.onchain_deal_id,
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
