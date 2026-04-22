import type {
  ProcessedTransactionInsert,
  ProcessedTransactionRow,
} from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";

export class ProcessedTransactionsRepositoryError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ProcessedTransactionsRepositoryError";
    this.code = code;
  }
}

export interface InsertProcessedTransactionInput {
  dealId: string | null;
  eventType: string;
  txHash: string;
}

export interface InsertProcessedTransactionResult {
  duplicate: boolean;
  row: ProcessedTransactionRow | null;
}

export interface ProcessConfirmedFundedEventOnceInput {
  buyerAddress: string;
  consultationLinkId: string;
  consumeLink: boolean;
  eventType: string;
  fundedAt: Date | null;
  onchainDealId: string;
  sellerAddress: string;
  status: "Funded";
  txHash: string;
}

export interface ProcessConfirmedFundedEventOnceResult {
  alreadyProcessed: boolean;
  dealId: string | null;
}

function toUtcIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export async function getByTxHash(
  txHash: string,
): Promise<ProcessedTransactionRow | null> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("processed_transactions")
    .select("*")
    .eq("tx_hash", txHash)
    .maybeSingle();

  if (error) {
    throw new ProcessedTransactionsRepositoryError(
      `Failed to load processed transaction: ${error.message}`,
      error.code,
    );
  }

  return data;
}

export async function insertProcessedTransaction(
  input: InsertProcessedTransactionInput,
): Promise<InsertProcessedTransactionResult> {
  const db = getServerDbClient().schema("public");
  const payload: ProcessedTransactionInsert = {
    deal_id: input.dealId,
    event_type: input.eventType,
    tx_hash: input.txHash,
  };

  const { data, error } = await db
    .from("processed_transactions")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        duplicate: true,
        row: null,
      };
    }

    throw new ProcessedTransactionsRepositoryError(
      `Failed to insert processed transaction: ${error.message}`,
      error.code,
    );
  }

  return {
    duplicate: false,
    row: data,
  };
}

export async function processConfirmedFundedEventOnce(
  input: ProcessConfirmedFundedEventOnceInput,
): Promise<ProcessConfirmedFundedEventOnceResult> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .rpc("process_confirmed_funded_event_once", {
      p_buyer_address: input.buyerAddress,
      p_consultation_link_id: input.consultationLinkId,
      p_consume_link: input.consumeLink,
      p_event_type: input.eventType,
      p_funded_at: toUtcIsoString(input.fundedAt),
      p_onchain_deal_id: input.onchainDealId,
      p_seller_address: input.sellerAddress,
      p_status: input.status,
      p_tx_hash: input.txHash,
    })
    .returns<{
      already_processed: boolean;
      deal_id: string | null;
    }[]>()
    .single();

  if (error) {
    throw new ProcessedTransactionsRepositoryError(
      `Failed to process confirmed funded event once: ${error.message}`,
      error.code,
    );
  }

  return {
    alreadyProcessed: data.already_processed,
    dealId: data.deal_id,
  };
}
