import "server-only";

import { getAddress } from "viem";

import type { CurrentUserContext } from "@/lib/auth/guards";
import type { DealRouteParams } from "@/lib/validators/deals";
import type { CreateDisputeMessageBody } from "@/lib/validators/dispute-messages";
import type {
  DealDisputeMessageRow,
  DisputeMessageAuthorRole,
} from "@/lib/db/types";
import {
  DealsRepositoryError,
  getDealActionContextById,
} from "@/server/repositories/deals";
import {
  createMessage,
  DisputeMessagesRepositoryError,
  listByDealId,
} from "@/server/repositories/dispute-messages";
import { createAuditLogEntry } from "@/server/repositories/audit-log";

export interface DisputeMessageModel {
  author_role: DisputeMessageAuthorRole;
  author_wallet: string;
  body: string;
  created_at: string;
  deal_id: string;
  evidence_url: string | null;
  id: string;
}

export class DisputeMessagesServiceError extends Error {
  code: string;
  status: number;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "DisputeMessagesServiceError";
    this.code = code;
    this.status = status;
  }
}

function isSameWallet(left: string, right: string): boolean {
  return getAddress(left) === getAddress(right);
}

function toModel(row: DealDisputeMessageRow): DisputeMessageModel {
  return {
    author_role: row.author_role,
    author_wallet: row.author_wallet,
    body: row.body,
    created_at: row.created_at,
    deal_id: row.deal_id,
    evidence_url: row.evidence_url,
    id: row.id,
  };
}

function resolveAuthorRole(
  currentUser: CurrentUserContext,
  buyerAddress: string,
  sellerAddress: string,
): DisputeMessageAuthorRole {
  if (isSameWallet(currentUser.wallet_address, buyerAddress)) {
    return "buyer";
  }

  if (isSameWallet(currentUser.wallet_address, sellerAddress)) {
    return "seller";
  }

  if (currentUser.is_admin) {
    return "admin";
  }

  throw new DisputeMessagesServiceError("Access denied.", 403, "NOT_DISPUTE_PARTICIPANT");
}

async function getContext(input: DealRouteParams) {
  try {
    return await getDealActionContextById(input.dealId);
  } catch (error) {
    if (error instanceof DealsRepositoryError) {
      throw new DisputeMessagesServiceError(
        "Failed to load deal.",
        500,
        error.code ?? "DEAL_LOAD_FAILED",
      );
    }

    throw error;
  }
}

function mapRepositoryError(error: unknown): never {
  if (error instanceof DisputeMessagesRepositoryError) {
    throw new DisputeMessagesServiceError(
      "Failed to load dispute messages.",
      500,
      error.code ?? "DISPUTE_MESSAGES_REPOSITORY_ERROR",
    );
  }

  throw error;
}

export async function listDisputeMessagesForDeal(
  currentUser: CurrentUserContext,
  input: DealRouteParams,
): Promise<DisputeMessageModel[]> {
  const context = await getContext(input);

  if (!context) {
    throw new DisputeMessagesServiceError("Deal not found.", 404, "DEAL_NOT_FOUND");
  }

  // Read is intentionally allowed in every deal status for participants/admins.
  // Before a dispute this returns an empty thread; after resolution it preserves history.
  resolveAuthorRole(currentUser, context.buyer_address, context.seller_address);

  try {
    return (await listByDealId(context.id)).map(toModel);
  } catch (error) {
    mapRepositoryError(error);
  }
}

export async function createDisputeMessageForDeal(
  currentUser: CurrentUserContext,
  input: DealRouteParams,
  body: CreateDisputeMessageBody,
): Promise<DisputeMessageModel> {
  const context = await getContext(input);

  if (!context) {
    throw new DisputeMessagesServiceError("Deal not found.", 404, "DEAL_NOT_FOUND");
  }

  const authorRole = resolveAuthorRole(
    currentUser,
    context.buyer_address,
    context.seller_address,
  );

  if (context.status !== "Disputed") {
    throw new DisputeMessagesServiceError(
      "Dispute messages can be added only while the deal is disputed.",
      409,
      "DEAL_NOT_DISPUTED",
    );
  }

  try {
    const message = await createMessage({
      authorRole,
      authorWallet: getAddress(currentUser.wallet_address),
      body: body.body,
      dealId: context.id,
      evidenceUrl: body.evidence_url,
    });

    createAuditLogEntry({
      action: "dispute_message_created",
      actorAddress: currentUser.wallet_address,
      entityId: context.id,
      entityType: "deal",
      metadata: {
        author_role: authorRole,
        has_evidence_url: Boolean(body.evidence_url),
        message_id: message.id,
      },
    }).catch((error) => {
      console.error("Failed to append dispute message audit log.", {
        dealId: context.id,
        error,
        messageId: message.id,
      });
    });

    return toModel(message);
  } catch (error) {
    mapRepositoryError(error);
  }
}
