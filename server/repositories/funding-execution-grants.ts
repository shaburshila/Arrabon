import type {
  FundingExecutionGrantInsert,
  FundingExecutionGrantRow,
  FundingExecutionGrantUpdate,
} from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";

export class FundingExecutionGrantsRepositoryError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "FundingExecutionGrantsRepositoryError";
    this.code = code;
  }
}

export interface CreateFundingExecutionGrantInput {
  consultationLinkId: string;
  expiresAt: string;
  issuedByWallet: string;
  issuedToWallet: string;
  tokenHash: string;
}

export interface ConsumeFundingExecutionGrantInput {
  consultationLinkId: string;
  issuedToWallet: string;
  now: string;
  tokenHash: string;
}

export async function createFundingExecutionGrant(
  input: CreateFundingExecutionGrantInput,
): Promise<FundingExecutionGrantRow> {
  const db = getServerDbClient().schema("public");
  const payload: FundingExecutionGrantInsert = {
    consultation_link_id: input.consultationLinkId,
    expires_at: input.expiresAt,
    issued_by_wallet: input.issuedByWallet,
    issued_to_wallet: input.issuedToWallet,
    token_hash: input.tokenHash,
  };

  const { data, error } = await db
    .from("funding_execution_grants")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new FundingExecutionGrantsRepositoryError(
      `Failed to create funding execution grant: ${error.message}`,
      error.code,
    );
  }

  return data;
}

export async function consumeFundingExecutionGrant(
  input: ConsumeFundingExecutionGrantInput,
): Promise<FundingExecutionGrantRow | null> {
  const db = getServerDbClient().schema("public");
  const payload: FundingExecutionGrantUpdate = {
    used_at: input.now,
  };

  const { data, error } = await db
    .from("funding_execution_grants")
    .update(payload)
    .eq("token_hash", input.tokenHash)
    .eq("consultation_link_id", input.consultationLinkId)
    .eq("issued_to_wallet", input.issuedToWallet)
    .is("used_at", null)
    .gt("expires_at", input.now)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new FundingExecutionGrantsRepositoryError(
      `Failed to consume funding execution grant: ${error.message}`,
      error.code,
    );
  }

  return data ?? null;
}
