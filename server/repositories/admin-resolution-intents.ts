import type {
  AdminResolutionIntentInsert,
  AdminResolutionIntentResolution,
  AdminResolutionIntentRow,
} from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";

export class AdminResolutionIntentsRepositoryError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "AdminResolutionIntentsRepositoryError";
    this.code = code;
  }
}

export interface CreateAdminResolutionIntentInput {
  adminWallet: string;
  dealId: string;
  onchainDealId: string;
  resolution: AdminResolutionIntentResolution;
}

export interface ConsumeLatestAdminResolutionIntentInput {
  onchainDealId: string;
  resolution: AdminResolutionIntentResolution;
}

export async function createAdminResolutionIntent(
  input: CreateAdminResolutionIntentInput,
): Promise<AdminResolutionIntentRow> {
  const db = getServerDbClient().schema("public");
  const payload: AdminResolutionIntentInsert = {
    admin_wallet: input.adminWallet,
    deal_id: input.dealId,
    onchain_deal_id: input.onchainDealId,
    resolution: input.resolution,
  };

  const { data, error } = await db
    .from("admin_resolution_intents")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new AdminResolutionIntentsRepositoryError(
      `Failed to create admin resolution intent: ${error.message}`,
      error.code,
    );
  }

  return data;
}

export async function consumeLatestAdminResolutionIntent(
  input: ConsumeLatestAdminResolutionIntentInput,
): Promise<AdminResolutionIntentRow | null> {
  const db = getServerDbClient().schema("public");
  const { data: intent, error: selectError } = await db
    .from("admin_resolution_intents")
    .select("*")
    .eq("onchain_deal_id", input.onchainDealId)
    .eq("resolution", input.resolution)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw new AdminResolutionIntentsRepositoryError(
      `Failed to load admin resolution intent: ${selectError.message}`,
      selectError.code,
    );
  }

  if (!intent) {
    return null;
  }

  const { error: updateError } = await db
    .from("admin_resolution_intents")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", intent.id)
    .is("consumed_at", null);

  if (updateError) {
    throw new AdminResolutionIntentsRepositoryError(
      `Failed to consume admin resolution intent: ${updateError.message}`,
      updateError.code,
    );
  }

  return intent;
}
