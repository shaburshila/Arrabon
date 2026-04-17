import "server-only";

import { getAddress } from "viem";

import type { CurrentUserContext } from "@/lib/auth/guards";
import type { DealCompletionRouteParams } from "@/lib/validators/deals-completion";
import {
  ConsultEscrowConfigError,
  prepareAutoReleaseCall,
  prepareConfirmReleaseCall,
  prepareMarkCompletedCall,
  prepareOpenDisputeCall,
  type PreparedDealLifecycleCall,
} from "@/lib/base/consult-escrow";
import { computeReleaseDeadlineMs } from "@/lib/constants/deals";
import {
  DealsRepositoryError,
  getDealActionContextById,
} from "@/server/repositories/deals";

export interface PreparedDealLifecycleResult {
  contract_call: PreparedDealLifecycleCall;
  deal_id: string;
}

export class DealCompletionServiceError extends Error {
  code: string;
  status: number;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "DealCompletionServiceError";
    this.code = code;
    this.status = status;
  }
}

function isSameWallet(left: string, right: string): boolean {
  return getAddress(left) === getAddress(right);
}

function computeReleaseDeadline(completedAt: string | null): Date {
  if (!completedAt) {
    throw new DealCompletionServiceError(
      "Deal completion timestamp is missing.",
      500,
      "COMPLETED_AT_MISSING",
    );
  }

  const completedAtMs = new Date(completedAt).getTime();

  if (Number.isNaN(completedAtMs)) {
    throw new DealCompletionServiceError(
      "Deal completion timestamp is invalid.",
      500,
      "COMPLETED_AT_INVALID",
    );
  }

  return new Date(computeReleaseDeadlineMs(completedAtMs));
}

function isEconnresetLike(error: unknown): error is Error & { code?: string } {
  const maybeError = error as (Error & { code?: string }) | null;

  return (
    error instanceof Error &&
    (error.message.includes("ECONNRESET") || maybeError?.code === "ECONNRESET")
  );
}

async function getActionContext(input: DealCompletionRouteParams) {
  try {
    return await getDealActionContextById(input.dealId);
  } catch (error) {
    if (error instanceof DealsRepositoryError) {
      throw new DealCompletionServiceError(
        "Failed to load deal.",
        500,
        error.code ?? "DEAL_LOAD_FAILED",
      );
    }

    if (isEconnresetLike(error)) {
      console.warn("Supabase cold start detected (ECONNRESET)", {
        code: error.code ?? "ECONNRESET",
        operation: "getActionContext.getDealActionContextById",
      });
    }

    throw error;
  }
}

function assertSeller(currentUser: CurrentUserContext, sellerAddress: string) {
  if (!isSameWallet(currentUser.wallet_address, sellerAddress)) {
    throw new DealCompletionServiceError(
      "Access denied.",
      403,
      "NOT_DEAL_SELLER",
    );
  }
}

function assertBuyer(currentUser: CurrentUserContext, buyerAddress: string) {
  if (!isSameWallet(currentUser.wallet_address, buyerAddress)) {
    throw new DealCompletionServiceError(
      "Access denied.",
      403,
      "NOT_DEAL_BUYER",
    );
  }
}

function buildPreparedResult(dealId: string, contractCall: PreparedDealLifecycleCall) {
  return {
    contract_call: contractCall,
    deal_id: dealId,
  };
}

export async function prepareMarkCompletedForDeal(
  currentUser: CurrentUserContext,
  input: DealCompletionRouteParams,
): Promise<PreparedDealLifecycleResult> {
  const context = await getActionContext(input);

  if (!context) {
    throw new DealCompletionServiceError("Deal not found.", 404, "DEAL_NOT_FOUND");
  }

  assertSeller(currentUser, context.seller_address);

  if (context.status !== "Funded") {
    throw new DealCompletionServiceError(
      "Deal cannot be marked completed in its current state.",
      409,
      "DEAL_NOT_FUNDED",
    );
  }

  try {
    // Prepare endpoints only authorize the contract call; confirmed event sync still owns final state.
    return buildPreparedResult(
      context.id,
      prepareMarkCompletedCall(context.onchain_deal_id),
    );
  } catch (error) {
    if (error instanceof ConsultEscrowConfigError) {
      throw new DealCompletionServiceError(
        error.message,
        500,
        "CONTRACT_CONFIG_UNAVAILABLE",
      );
    }

    throw error;
  }
}

export async function prepareConfirmReleaseForDeal(
  currentUser: CurrentUserContext,
  input: DealCompletionRouteParams,
  now: Date = new Date(),
): Promise<PreparedDealLifecycleResult> {
  const context = await getActionContext(input);

  if (!context) {
    throw new DealCompletionServiceError("Deal not found.", 404, "DEAL_NOT_FOUND");
  }

  assertBuyer(currentUser, context.buyer_address);

  if (context.status !== "ConfirmPending") {
    throw new DealCompletionServiceError(
      "Deal cannot be released in its current state.",
      409,
      "DEAL_NOT_CONFIRM_PENDING",
    );
  }

  const releaseDeadline = computeReleaseDeadline(context.completed_at);

  // The buyer window is inclusive at the exact deadline; auto-release becomes valid only after it passes.
  if (now.getTime() > releaseDeadline.getTime()) {
    throw new DealCompletionServiceError(
      "Release deadline has passed.",
      409,
      "RELEASE_DEADLINE_PASSED",
    );
  }

  try {
    return buildPreparedResult(
      context.id,
      prepareConfirmReleaseCall(context.onchain_deal_id),
    );
  } catch (error) {
    if (error instanceof ConsultEscrowConfigError) {
      throw new DealCompletionServiceError(
        error.message,
        500,
        "CONTRACT_CONFIG_UNAVAILABLE",
      );
    }

    throw error;
  }
}

export async function prepareOpenDisputeForDeal(
  currentUser: CurrentUserContext,
  input: DealCompletionRouteParams,
  now: Date = new Date(),
): Promise<PreparedDealLifecycleResult> {
  const context = await getActionContext(input);

  if (!context) {
    throw new DealCompletionServiceError("Deal not found.", 404, "DEAL_NOT_FOUND");
  }

  assertBuyer(currentUser, context.buyer_address);

  if (context.status === "Funded") {
    try {
      return buildPreparedResult(
        context.id,
        prepareOpenDisputeCall(context.onchain_deal_id),
      );
    } catch (error) {
      if (error instanceof ConsultEscrowConfigError) {
        throw new DealCompletionServiceError(
          error.message,
          500,
          "CONTRACT_CONFIG_UNAVAILABLE",
        );
      }

      throw error;
    }
  }

  if (context.status !== "ConfirmPending") {
    throw new DealCompletionServiceError(
      "Deal cannot be disputed in its current state.",
      409,
      "DEAL_NOT_DISPUTABLE",
    );
  }

  const releaseDeadline = computeReleaseDeadline(context.completed_at);

  if (now.getTime() > releaseDeadline.getTime()) {
    throw new DealCompletionServiceError(
      "Dispute window has closed.",
      409,
      "DISPUTE_WINDOW_CLOSED",
    );
  }

  try {
    return buildPreparedResult(
      context.id,
      prepareOpenDisputeCall(context.onchain_deal_id),
    );
  } catch (error) {
    if (error instanceof ConsultEscrowConfigError) {
      throw new DealCompletionServiceError(
        error.message,
        500,
        "CONTRACT_CONFIG_UNAVAILABLE",
      );
    }

    throw error;
  }
}

export async function prepareAutoReleaseForDeal(
  input: DealCompletionRouteParams,
  now: Date = new Date(),
): Promise<PreparedDealLifecycleResult> {
  const context = await getActionContext(input);

  if (!context) {
    throw new DealCompletionServiceError("Deal not found.", 404, "DEAL_NOT_FOUND");
  }

  if (context.status !== "ConfirmPending") {
    throw new DealCompletionServiceError(
      "Deal cannot be auto-released in its current state.",
      409,
      "DEAL_NOT_CONFIRM_PENDING",
    );
  }

  const releaseDeadline = computeReleaseDeadline(context.completed_at);

  if (now.getTime() <= releaseDeadline.getTime()) {
    throw new DealCompletionServiceError(
      "Auto-release is available only after the dispute window closes.",
      409,
      "AUTO_RELEASE_NOT_AVAILABLE",
    );
  }

  try {
    return buildPreparedResult(
      context.id,
      prepareAutoReleaseCall(context.onchain_deal_id),
    );
  } catch (error) {
    if (error instanceof ConsultEscrowConfigError) {
      throw new DealCompletionServiceError(
        error.message,
        500,
        "CONTRACT_CONFIG_UNAVAILABLE",
      );
    }

    throw error;
  }
}
