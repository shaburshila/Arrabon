import type {
  Database,
  DealRow,
} from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";

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
