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
