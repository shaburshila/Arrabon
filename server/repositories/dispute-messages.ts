import type {
  Database,
  DealDisputeMessageRow,
  DisputeMessageAuthorRole,
} from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";

type DisputeMessagesTable = Database["public"]["Tables"]["deal_dispute_messages"];

export class DisputeMessagesRepositoryError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "DisputeMessagesRepositoryError";
    this.code = code;
  }
}

export interface CreateDisputeMessageInput {
  authorRole: DisputeMessageAuthorRole;
  authorWallet: string;
  body: string;
  dealId: string;
  evidenceUrl: string | null;
}

export async function listByDealId(dealId: string): Promise<DealDisputeMessageRow[]> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("deal_dispute_messages")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new DisputeMessagesRepositoryError(
      `Failed to list dispute messages: ${error.message}`,
      error.code,
    );
  }

  return data ?? [];
}

export async function createMessage(
  input: CreateDisputeMessageInput,
): Promise<DealDisputeMessageRow> {
  const db = getServerDbClient().schema("public");
  const payload: DisputeMessagesTable["Insert"] = {
    author_role: input.authorRole,
    author_wallet: input.authorWallet,
    body: input.body,
    deal_id: input.dealId,
    evidence_url: input.evidenceUrl,
  };

  const { data, error } = await db
    .from("deal_dispute_messages")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new DisputeMessagesRepositoryError(
      `Failed to create dispute message: ${error.message}`,
      error.code,
    );
  }

  return data;
}
