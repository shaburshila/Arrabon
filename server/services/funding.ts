import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { getAddress, parseUnits } from "viem";

import type { CurrentUserContext } from "@/lib/auth/guards";
import { assertLinkHash } from "@/lib/crypto/link-hash";
import { resolveEffectiveConsultationLinkStatus } from "@/lib/constants/consultation-links";
import type { ConsultationLinkRow, ConsultationLinkStatus } from "@/lib/db/types";
import { assertCompliance } from "@/lib/compliance/error-mapping";
import type { PrepareFundingParams } from "@/lib/validators/funding";
import {
  ConsultEscrowConfigError,
  getConsultEscrowContractAddress,
  prepareCreateAndFundDealCall,
  type PreparedCreateAndFundDealCall,
} from "@/lib/base/consult-escrow";
import {
  createFundingAuthorizationNonce,
  signFundingAuthorization,
} from "@/lib/base/funding-authorization";
import {
  DealsRepositoryError,
  getByConsultationLinkId,
} from "@/server/repositories/deals";
import {
  ConsultationLinksRepositoryError,
  getById,
} from "@/server/repositories/consultation-links";
import {
  createFundingExecutionGrant,
  consumeFundingExecutionGrant,
  FundingExecutionGrantsRepositoryError,
} from "@/server/repositories/funding-execution-grants";
import { screenWalletsBatch } from "@/server/services/compliance";

type FundingUnavailableStatus = "Cancelled" | "Consumed" | "Expired";

export interface FundingGrantIssueResult {
  approval_amount: string;
  buyer_address: string;
  consultation_link_id: string;
  contract_address: string;
  expires_at: string;
  grant_token: string;
  schedule: {
    duration_minutes: number;
    scheduled_at: string;
  };
  seller_address: string;
}

export interface PrepareFundingResult {
  consultation_link_id: string;
  contract_call: PreparedCreateAndFundDealCall;
}

const FUNDING_GRANT_TTL_MS = 300_000;
const FUNDING_AUTHORIZATION_LIFETIME_SECONDS = BigInt(180);

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

function buildGrantToken(): { token: string; tokenHash: string } {
  const rawToken = randomBytes(32);

  return {
    token: rawToken.toString("hex"),
    tokenHash: createHash("sha256").update(rawToken).digest("hex"),
  };
}

async function issueFundingGrant(input: {
  currentUser: CurrentUserContext;
  link: ConsultationLinkRow;
  now: Date;
}): Promise<FundingGrantIssueResult> {
  const { token, tokenHash } = buildGrantToken();
  const expiresAt = new Date(input.now.getTime() + FUNDING_GRANT_TTL_MS).toISOString();
  let contractAddress: string;

  try {
    await createFundingExecutionGrant({
      consultationLinkId: input.link.id,
      expiresAt,
      issuedByWallet: input.currentUser.wallet_address,
      issuedToWallet: input.currentUser.wallet_address,
      tokenHash,
    });

    contractAddress = getConsultEscrowContractAddress();
  } catch (error) {
    if (error instanceof ConsultEscrowConfigError) {
      throw new FundingServiceError(error.message, 500, "CONTRACT_CONFIG_UNAVAILABLE");
    }

    if (error instanceof FundingExecutionGrantsRepositoryError) {
      throw new FundingServiceError(
        "Failed to issue funding authorization.",
        500,
        error.code ?? "FUNDING_GRANT_CREATE_FAILED",
      );
    }

    throw error;
  }

  return {
    approval_amount: parseUnits(String(input.link.price_usdc), 6).toString(10),
    buyer_address: getAddress(input.currentUser.wallet_address),
    consultation_link_id: input.link.id,
    contract_address: contractAddress,
    expires_at: expiresAt,
    grant_token: token,
    schedule: {
      duration_minutes: input.link.duration_minutes,
      scheduled_at: input.link.scheduled_at,
    },
    seller_address: getAddress(input.link.expert_address),
  };
}

async function consumeFundingGrant(input: {
  consultationLinkId: string;
  currentUser: CurrentUserContext;
  grantToken: string;
  now: Date;
}) {
  const rawToken = Buffer.from(input.grantToken, "hex");

  if (rawToken.length !== 32) {
    throw new FundingServiceError(
      "Funding authorization is invalid or expired.",
      409,
      "FUNDING_GRANT_INVALID",
    );
  }

  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  try {
    const grant = await consumeFundingExecutionGrant({
      consultationLinkId: input.consultationLinkId,
      issuedToWallet: input.currentUser.wallet_address,
      now: input.now.toISOString(),
      tokenHash,
    });

    if (!grant) {
      throw new FundingServiceError(
        "Funding authorization is invalid or expired.",
        409,
        "FUNDING_GRANT_INVALID",
      );
    }

    return grant;
  } catch (error) {
    if (error instanceof FundingServiceError) {
      throw error;
    }

    if (error instanceof FundingExecutionGrantsRepositoryError) {
      throw new FundingServiceError(
        "Failed to consume funding authorization.",
        500,
        error.code ?? "FUNDING_GRANT_CONSUME_FAILED",
      );
    }

    throw error;
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
): Promise<FundingGrantIssueResult> {
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

  return issueFundingGrant({ currentUser, link, now });
}

export async function exchangeFundingGrantForLink(
  currentUser: CurrentUserContext,
  input: PrepareFundingParams,
  grantToken: string,
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
        operation: "exchangeFundingGrantForLink.getById",
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
        operation: "exchangeFundingGrantForLink.getByConsultationLinkId",
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

  const screeningContext = {
    action: "funding_prepare" as const,
    actorWallet: currentUser.wallet_address,
    dealId: null,
  };
  const screeningResults = await screenWalletsBatch(
    [currentUser.wallet_address, link.expert_address],
    screeningContext,
  );

  for (const result of screeningResults) {
    assertCompliance(result, result.walletAddress, screeningContext);
  }

  await consumeFundingGrant({
    consultationLinkId: input.linkId,
    currentUser,
    grantToken,
    now,
  });

  try {
    const price = parseUnits(String(link.price_usdc), 6);
    const linkHash = assertLinkHash(link.link_hash);
    const scheduledAt = BigInt(Math.floor(new Date(link.scheduled_at).getTime() / 1000));
    const deadline = BigInt(Math.floor(now.getTime() / 1000)) + FUNDING_AUTHORIZATION_LIFETIME_SECONDS;
    const nonce = createFundingAuthorizationNonce();
    const signature = await signFundingAuthorization({
      buyer: getAddress(currentUser.wallet_address),
      deadline,
      durationMinutes: BigInt(link.duration_minutes),
      linkHash: linkHash as `0x${string}`,
      nonce,
      price,
      scheduledAt,
      seller: getAddress(link.expert_address),
    });

    return {
      consultation_link_id: link.id,
      contract_call: prepareCreateAndFundDealCall({
        buyerAddress: currentUser.wallet_address,
        deadline,
        durationMinutes: link.duration_minutes,
        linkHash: link.link_hash,
        nonce,
        priceUsdc: String(link.price_usdc),
        scheduledAt: new Date(link.scheduled_at),
        sellerAddress: link.expert_address,
        signature,
      }),
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
