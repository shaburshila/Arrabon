import type {
  PayoutExecutionGrantAction,
  PayoutExecutionGrantInsert,
  PayoutExecutionGrantResolution,
  PayoutExecutionGrantRow,
  PayoutExecutionGrantUpdate,
} from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";

export class PayoutExecutionGrantsRepositoryError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "PayoutExecutionGrantsRepositoryError";
    this.code = code;
  }
}

export interface CreatePayoutExecutionGrantInput {
  action: PayoutExecutionGrantAction;
  dealId: string;
  expiresAt: string;
  issuedByWallet: string;
  issuedToWallet: string;
  resolution?: PayoutExecutionGrantResolution | null;
  tokenHash: string;
}

export interface ConsumePayoutExecutionGrantInput {
  allowedActions: PayoutExecutionGrantAction[];
  dealId: string;
  issuedToWallet: string;
  now: string;
  tokenHash: string;
}

export async function createPayoutExecutionGrant(
  input: CreatePayoutExecutionGrantInput,
): Promise<PayoutExecutionGrantRow> {
  const db = getServerDbClient().schema("public");
  const payload: PayoutExecutionGrantInsert = {
    action: input.action,
    deal_id: input.dealId,
    expires_at: input.expiresAt,
    issued_by_wallet: input.issuedByWallet,
    issued_to_wallet: input.issuedToWallet,
    resolution: input.resolution ?? null,
    token_hash: input.tokenHash,
  };

  const { data, error } = await db
    .from("payout_execution_grants")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new PayoutExecutionGrantsRepositoryError(
      `Failed to create payout execution grant: ${error.message}`,
      error.code,
    );
  }

  return data;
}

export async function consumePayoutExecutionGrant(
  input: ConsumePayoutExecutionGrantInput,
): Promise<PayoutExecutionGrantRow | null> {
  const db = getServerDbClient().schema("public");
  const payload: PayoutExecutionGrantUpdate = {
    used_at: input.now,
  };

  const { data, error } = await db
    .from("payout_execution_grants")
    .update(payload)
    .eq("token_hash", input.tokenHash)
    .eq("deal_id", input.dealId)
    .eq("issued_to_wallet", input.issuedToWallet)
    .is("used_at", null)
    .gt("expires_at", input.now)
    .in("action", input.allowedActions)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new PayoutExecutionGrantsRepositoryError(
      `Failed to consume payout execution grant: ${error.message}`,
      error.code,
    );
  }

  return data ?? null;
}
