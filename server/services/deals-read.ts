import "server-only";

import { getAddress } from "viem";

import type { CurrentUserContext } from "@/lib/auth/guards";
import { DISPUTE_WINDOW_MS } from "@/lib/constants/deals";
import type { DealStatus } from "@/lib/db/types";
import type { DealRouteParams } from "@/lib/validators/deals";
import { decryptMeetingUrl } from "@/lib/crypto/meeting-url";
import { createAuditLogEntry } from "@/server/repositories/audit-log";
import {
  DealsRepositoryError,
  getDealReadViewById,
  getDealRevealContextById,
} from "@/server/repositories/deals";

const REVEAL_ALLOWED_STATUSES: ReadonlySet<DealStatus> = new Set([
  "Funded",
  "ConfirmPending",
  "Released",
  "Disputed",
]);

export interface DealReadModel {
  buyer_address: string;
  completed_at: string | null;
  consultation_link_id: string;
  id: string;
  onchain_deal_id: string;
  release_deadline_at: string | null;
  scheduled_at: string;
  seller_address: string;
  status: DealStatus;
  tx_hash: string | null;
}

export interface RevealedMeetingUrl {
  meeting_url: string;
}

export class DealReadServiceError extends Error {
  code: string;
  status: number;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "DealReadServiceError";
    this.code = code;
    this.status = status;
  }
}

function computeReleaseDeadline(completedAt: string | null): string | null {
  if (!completedAt) {
    return null;
  }

  const completedAtMs = new Date(completedAt).getTime();

  if (Number.isNaN(completedAtMs)) {
    throw new DealReadServiceError(
      "Deal completion timestamp is invalid.",
      500,
      "DEAL_INTEGRITY_ERROR",
    );
  }

  return new Date(completedAtMs + DISPUTE_WINDOW_MS).toISOString();
}

function isSameWallet(left: string, right: string): boolean {
  return getAddress(left) === getAddress(right);
}

function validateDecryptedMeetingUrl(meetingUrl: string): string {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(meetingUrl);
  } catch {
    throw new DealReadServiceError(
      "Meeting URL is unavailable.",
      500,
      "MEETING_URL_INVALID",
    );
  }

  if (parsedUrl.protocol !== "https:") {
    throw new DealReadServiceError(
      "Meeting URL is unavailable.",
      500,
      "MEETING_URL_INVALID",
    );
  }

  return meetingUrl;
}

function isEconnresetLike(error: unknown): error is Error & { code?: string } {
  const maybeError = error as (Error & { code?: string }) | null;

  return (
    error instanceof Error &&
    (error.message.includes("ECONNRESET") || maybeError?.code === "ECONNRESET")
  );
}

async function logRevealAttempt(
  input: {
    actorAddress: string | null;
    code: string;
    dealId: string;
    outcome:
      | "decrypt_error"
      | "forbidden"
      | "integrity_error"
      | "not_found"
      | "state_blocked"
      | "success"
      | "unauthenticated";
    consultationLinkId?: string;
    dealStatus?: DealStatus;
  },
) {
  try {
    await createAuditLogEntry({
      action: "meeting_url_reveal_attempt",
      actorAddress: input.actorAddress,
      entityId: input.dealId,
      entityType: "deal",
      metadata: {
        code: input.code,
        consultation_link_id: input.consultationLinkId ?? null,
        deal_id: input.dealId,
        deal_status: input.dealStatus ?? null,
        outcome: input.outcome,
        request_path: `/api/deals/${input.dealId}/meeting-url`,
      },
    });
  } catch {
    throw new DealReadServiceError(
      "Internal server error.",
      500,
      "AUDIT_LOG_WRITE_FAILED",
    );
  }
}

export async function getDealReadModel(
  input: DealRouteParams,
): Promise<DealReadModel> {
  let deal;

  try {
    deal = await getDealReadViewById(input.dealId);
  } catch (error) {
    if (error instanceof DealsRepositoryError) {
      throw new DealReadServiceError(
        "Failed to load deal.",
        500,
        "DEAL_READ_FAILED",
      );
    }

    if (isEconnresetLike(error)) {
      console.warn("Supabase cold start detected (ECONNRESET)", {
        code: error.code ?? "ECONNRESET",
        operation: "getDealReadModel.getDealReadViewById",
      });
    }

    throw error;
  }

  if (!deal) {
    throw new DealReadServiceError("Deal not found.", 404, "DEAL_NOT_FOUND");
  }

  return {
    buyer_address: deal.buyer_address,
    completed_at: deal.completed_at,
    consultation_link_id: deal.consultation_link_id,
    id: deal.id,
    onchain_deal_id: deal.onchain_deal_id,
    release_deadline_at: computeReleaseDeadline(deal.completed_at),
    scheduled_at: deal.scheduled_at,
    seller_address: deal.seller_address,
    status: deal.status,
    tx_hash: deal.tx_hash,
  };
}

export async function revealMeetingUrlForDeal(
  currentUser: CurrentUserContext,
  input: DealRouteParams,
): Promise<RevealedMeetingUrl> {
  const actorAddress = currentUser.wallet_address;
  let context;

  try {
    context = await getDealRevealContextById(input.dealId);
  } catch (error) {
    await logRevealAttempt({
      actorAddress,
      code: "DEAL_REVEAL_LOAD_FAILED",
      dealId: input.dealId,
      outcome: "integrity_error",
    });

    if (error instanceof DealsRepositoryError) {
      throw new DealReadServiceError(
        "Failed to load deal.",
        500,
        "DEAL_REVEAL_LOAD_FAILED",
      );
    }

    if (isEconnresetLike(error)) {
      console.warn("Supabase cold start detected (ECONNRESET)", {
        code: error.code ?? "ECONNRESET",
        operation: "revealMeetingUrlForDeal.getDealRevealContextById",
      });
    }

    throw error;
  }

  if (!context) {
    await logRevealAttempt({
      actorAddress,
      code: "DEAL_NOT_FOUND",
      dealId: input.dealId,
      outcome: "not_found",
    });
    throw new DealReadServiceError("Deal not found.", 404, "DEAL_NOT_FOUND");
  }

  if (!isSameWallet(context.seller_address, context.expert_address)) {
    await logRevealAttempt({
      actorAddress,
      code: "SELLER_LINK_MISMATCH",
      consultationLinkId: context.consultation_link_id,
      dealId: input.dealId,
      dealStatus: context.status,
      outcome: "integrity_error",
    });
    throw new DealReadServiceError(
      "Meeting URL is unavailable.",
      500,
      "SELLER_LINK_MISMATCH",
    );
  }

  const isBuyer = isSameWallet(actorAddress, context.buyer_address);
  const isSeller = isSameWallet(actorAddress, context.expert_address);

  if (!isBuyer && !isSeller) {
    await logRevealAttempt({
      actorAddress,
      code: "NOT_DEAL_PARTICIPANT",
      consultationLinkId: context.consultation_link_id,
      dealId: input.dealId,
      dealStatus: context.status,
      outcome: "forbidden",
    });
    throw new DealReadServiceError(
      "Access denied.",
      403,
      "NOT_DEAL_PARTICIPANT",
    );
  }

  if (!REVEAL_ALLOWED_STATUSES.has(context.status)) {
    await logRevealAttempt({
      actorAddress,
      code: "DEAL_REVEAL_NOT_ALLOWED",
      consultationLinkId: context.consultation_link_id,
      dealId: input.dealId,
      dealStatus: context.status,
      outcome: "state_blocked",
    });
    throw new DealReadServiceError(
      "Meeting URL is not available for this deal state.",
      409,
      "DEAL_REVEAL_NOT_ALLOWED",
    );
  }

  if (context.meeting_url_encrypted.trim().length === 0) {
    await logRevealAttempt({
      actorAddress,
      code: "MEETING_URL_MISSING",
      consultationLinkId: context.consultation_link_id,
      dealId: input.dealId,
      dealStatus: context.status,
      outcome: "integrity_error",
    });
    throw new DealReadServiceError(
      "Meeting URL is unavailable.",
      500,
      "MEETING_URL_MISSING",
    );
  }

  let meetingUrl: string;

  try {
    meetingUrl = validateDecryptedMeetingUrl(
      decryptMeetingUrl(context.meeting_url_encrypted),
    );
  } catch (error) {
    const code =
      error instanceof DealReadServiceError
        ? error.code
        : "MEETING_URL_DECRYPT_FAILED";

    await logRevealAttempt({
      actorAddress,
      code,
      consultationLinkId: context.consultation_link_id,
      dealId: input.dealId,
      dealStatus: context.status,
      outcome: "decrypt_error",
    });

    if (error instanceof DealReadServiceError) {
      throw error;
    }

    throw new DealReadServiceError(
      "Meeting URL is unavailable.",
      500,
      "MEETING_URL_DECRYPT_FAILED",
    );
  }

  await logRevealAttempt({
    actorAddress,
    code: "MEETING_URL_REVEALED",
    consultationLinkId: context.consultation_link_id,
    dealId: input.dealId,
    dealStatus: context.status,
    outcome: "success",
  });

  return {
    meeting_url: meetingUrl,
  };
}
