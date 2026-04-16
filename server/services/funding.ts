import "server-only";

import { getAddress } from "viem";

import type { CurrentUserContext } from "@/lib/auth/guards";
import { resolveEffectiveConsultationLinkStatus } from "@/lib/constants/consultation-links";
import type { ConsultationLinkRow, ConsultationLinkStatus } from "@/lib/db/types";
import type { PrepareFundingParams } from "@/lib/validators/funding";
import {
  ConsultEscrowConfigError,
  prepareCreateAndFundDealCall,
  type PreparedCreateAndFundDealCall,
} from "@/lib/base/consult-escrow";
import {
  DealsRepositoryError,
  getByConsultationLinkId,
} from "@/server/repositories/deals";
import {
  ConsultationLinksRepositoryError,
  getById,
} from "@/server/repositories/consultation-links";

type FundingUnavailableStatus = "Cancelled" | "Consumed" | "Expired";

export interface PrepareFundingResult {
  buyer_address: string;
  consultation_link_id: string;
  contract_call: PreparedCreateAndFundDealCall;
  link_hash: string;
  schedule: {
    duration_minutes: number;
    scheduled_at: string;
  };
  seller_address: string;
}

export class FundingServiceError extends Error {
  code: string;
  status: number;
  statusValue?: FundingUnavailableStatus;

  constructor(message: string, status: number, code: string, statusValue?: FundingUnavailableStatus) {
    super(message);
    this.name = "FundingServiceError";
    this.code = code;
    this.status = status;
    this.statusValue = statusValue;
  }
}

function resolveFundingStatus(row: ConsultationLinkRow, now: Date): ConsultationLinkStatus {
  return resolveEffectiveConsultationLinkStatus(row, now);
}

function createUnavailableFundingError(statusValue: FundingUnavailableStatus): FundingServiceError {
  switch (statusValue) {
    case "Expired":
      return new FundingServiceError("Link has expired.", 410, "LINK_EXPIRED", statusValue);
    case "Cancelled":
      return new FundingServiceError("Link has been cancelled.", 410, "LINK_CANCELLED", statusValue);
    case "Consumed":
      return new FundingServiceError("Link has already been consumed.", 410, "LINK_CONSUMED", statusValue);
  }
}

function isSameWallet(left: string, right: string): boolean {
  return getAddress(left) === getAddress(right);
}

function isEconnresetLike(error: unknown): error is Error & { code?: string } {
  const maybeError = error as (Error & { code?: string }) | null;

  return (
    error instanceof Error &&
    (error.message.includes("ECONNRESET") || maybeError?.code === "ECONNRESET")
  );
}

export async function prepareFundingForLink(
  currentUser: CurrentUserContext,
  input: PrepareFundingParams,
  now: Date = new Date(),
): Promise<PrepareFundingResult> {
  let link;

  try {
    link = await getById(input.linkId);
  } catch (error) {
    if (error instanceof ConsultationLinksRepositoryError) {
      throw new FundingServiceError(
        "Failed to load consultation link.",
        500,
        error.code ?? "LINK_LOAD_FAILED",
      );
    }

    if (isEconnresetLike(error)) {
      console.warn("Supabase cold start detected (ECONNRESET)", {
        code: error.code ?? "ECONNRESET",
        operation: "prepareFundingForLink.getById",
      });
    }

    throw error;
  }

  if (!link) {
    throw new FundingServiceError("Link not found.", 404, "LINK_NOT_FOUND");
  }

  const effectiveStatus = resolveFundingStatus(link, now);

  if (effectiveStatus === "Draft") {
    throw new FundingServiceError("Link not found.", 404, "LINK_NOT_FOUND");
  }

  if (effectiveStatus !== "Open") {
    throw createUnavailableFundingError(effectiveStatus);
  }

  if (isSameWallet(currentUser.wallet_address, link.expert_address)) {
    throw new FundingServiceError(
      "Buyer wallet must be different from seller wallet.",
      403,
      "BUYER_EQUALS_SELLER",
    );
  }

  let existingDeal;

  try {
    existingDeal = await getByConsultationLinkId(link.id);
  } catch (error) {
    if (error instanceof DealsRepositoryError) {
      throw new FundingServiceError(
        "Failed to load deal.",
        500,
        error.code ?? "DEAL_LOAD_FAILED",
      );
    }

    if (isEconnresetLike(error)) {
      console.warn("Supabase cold start detected (ECONNRESET)", {
        code: error.code ?? "ECONNRESET",
        operation: "prepareFundingForLink.getByConsultationLinkId",
      });
    }

    throw error;
  }

  if (existingDeal) {
    throw new FundingServiceError(
      "Deal already exists for this consultation link.",
      409,
      "DEAL_ALREADY_EXISTS",
    );
  }

  try {
    return {
      buyer_address: getAddress(currentUser.wallet_address),
      consultation_link_id: link.id,
      contract_call: prepareCreateAndFundDealCall({
        buyerAddress: currentUser.wallet_address,
        durationMinutes: link.duration_minutes,
        linkHash: link.link_hash,
        priceUsdc: String(link.price_usdc),
        scheduledAt: new Date(link.scheduled_at),
        sellerAddress: link.expert_address,
      }),
      link_hash: link.link_hash,
      schedule: {
        duration_minutes: link.duration_minutes,
        scheduled_at: link.scheduled_at,
      },
      seller_address: getAddress(link.expert_address),
    };
  } catch (error) {
    if (error instanceof ConsultEscrowConfigError) {
      throw new FundingServiceError(error.message, 500, "CONTRACT_CONFIG_UNAVAILABLE");
    }

    if (error instanceof Error) {
      throw new FundingServiceError(error.message, 500, "FUNDING_PREPARATION_FAILED");
    }

    throw new FundingServiceError(
      "Failed to prepare funding call.",
      500,
      "FUNDING_PREPARATION_FAILED",
    );
  }
}
