import "server-only";

import { getAddress } from "viem";

import type { CurrentUserContext } from "@/lib/auth/guards";
import { resolveEffectiveConsultationLinkStatus } from "@/lib/constants/consultation-links";
import type {
  ConsultationLinkRow,
  ConsultationLinkStatus,
  DealResolutionType,
  DealStatus,
} from "@/lib/db/types";
import { encryptMeetingUrl } from "@/lib/crypto/meeting-url";
import { assertLinkHash, generateLinkHash } from "@/lib/crypto/link-hash";
import { assertCompliance } from "@/lib/compliance/error-mapping";
import type { ListPagination } from "@/lib/validators/pagination";
import type { CreateConsultationLinkInput } from "@/lib/validators/consultation-links";
import {
  ConsultationLinksRepositoryError,
  createLink,
  getById,
  getByCreatorUserId,
  updateStatus,
} from "@/server/repositories/consultation-links";
import {
  DealsRepositoryError,
  getByConsultationLinkId,
  getByConsultationLinkIds,
} from "@/server/repositories/deals";
import { screenWalletForDeal } from "@/server/services/compliance";

const LINK_HASH_INSERT_RETRY_COUNT = 3;
type PublicUnavailableStatus = "Cancelled" | "Expired";

export interface CreateConsultationLinkResult {
  id: string;
  link_hash: string;
  share_url: string;
  status: "Open";
}

export interface PublicConsultationLinkResult {
  deal_id: string | null;
  description: string;
  duration_minutes: number;
  expires_at: string;
  id: string;
  meeting_url_revealed: false;
  price_usdc: string;
  scheduled_at: string;
  seller_address: string;
  status: "Consumed" | "Open";
  timezone: string;
  title: string;
}

export interface CancelConsultationLinkResult {
  ok: true;
  status: "Cancelled";
}

export class ConsultationLinkServiceError extends Error {
  code: string;
  status: number;
  statusValue?: PublicUnavailableStatus | "unavailable";

  constructor(message: string, status: number, code: string, statusValue?: PublicUnavailableStatus | "unavailable") {
    super(message);
    this.name = "ConsultationLinkServiceError";
    this.status = status;
    this.code = code;
    this.statusValue = statusValue;
  }
}

function resolvePublicStatus(
  row: ConsultationLinkRow,
  now: Date,
): ConsultationLinkStatus {
  return resolveEffectiveConsultationLinkStatus(row, now);
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

function mapPublicLink(
  row: ConsultationLinkRow,
  publicStatus: "Consumed" | "Open",
  dealId: string | null,
): PublicConsultationLinkResult {
  return {
    deal_id: dealId,
    description: row.description,
    duration_minutes: row.duration_minutes,
    expires_at: row.expires_at,
    id: row.id,
    meeting_url_revealed: false,
    price_usdc: String(row.price_usdc),
    scheduled_at: row.scheduled_at,
    seller_address: row.expert_address,
    status: publicStatus,
    timezone: row.timezone,
    title: row.title,
  };
}

function createUnavailableLinkError(statusValue: PublicUnavailableStatus): ConsultationLinkServiceError {
  switch (statusValue) {
    case "Expired":
      return new ConsultationLinkServiceError("Link has expired.", 410, "LINK_EXPIRED", statusValue);
    case "Cancelled":
      return new ConsultationLinkServiceError("Link has been cancelled.", 410, "LINK_CANCELLED", statusValue);
  }
}

export interface MyLinkResult {
  deal_id: string | null;
  deal_resolution_type: DealResolutionType | null;
  deal_resolved_at: string | null;
  deal_resolved_from_status: DealStatus | null;
  deal_status: DealStatus | null;
  description: string;
  duration_minutes: number;
  expires_at: string;
  id: string;
  price_usdc: string;
  scheduled_at: string;
  share_url: string;
  status: ConsultationLinkStatus;
  timezone: string;
  title: string;
}

export async function listMyConsultationLinks(
  currentUser: CurrentUserContext,
  now: Date = new Date(),
  pagination?: Partial<ListPagination>,
): Promise<MyLinkResult[]> {
  let rows: ConsultationLinkRow[];

  try {
    rows = await getByCreatorUserId(currentUser.id, pagination);
  } catch (error) {
    if (error instanceof ConsultationLinksRepositoryError) {
      throw new ConsultationLinkServiceError(
        "Failed to load consultation links.",
        500,
        error.code ?? "LINKS_LOAD_FAILED",
      );
    }

    throw error;
  }

  let dealsByLinkId: Map<string, Awaited<ReturnType<typeof getByConsultationLinkIds>>[number]>;

  try {
    const deals = await getByConsultationLinkIds(rows.map((row) => row.id));
    dealsByLinkId = new Map(deals.map((deal) => [deal.consultation_link_id, deal]));
  } catch (error) {
    if (error instanceof DealsRepositoryError) {
      throw new ConsultationLinkServiceError(
        "Failed to load consultation links.",
        500,
        error.code ?? "DEALS_LOAD_FAILED",
      );
    }

    throw error;
  }

  return rows.map((row) => {
    const existingDeal = dealsByLinkId.get(row.id);
    const effectiveStatus = resolveEffectiveConsultationLinkStatus(row, now);
    const status =
      effectiveStatus === "Cancelled" || effectiveStatus === "Expired"
        ? effectiveStatus
        : existingDeal
          ? "Consumed"
          : effectiveStatus;

    return {
      deal_id: existingDeal?.id ?? null,
      deal_resolution_type: existingDeal?.resolution_type ?? null,
      deal_resolved_at: existingDeal?.resolved_at ?? null,
      deal_resolved_from_status: existingDeal?.resolved_from_status ?? null,
      deal_status: existingDeal?.status ?? null,
      description: row.description,
      duration_minutes: row.duration_minutes,
      expires_at: row.expires_at,
      id: row.id,
      price_usdc: String(row.price_usdc),
      scheduled_at: row.scheduled_at,
      share_url: existingDeal ? `/deal/${existingDeal.id}` : `/link/${row.id}`,
      status,
      timezone: row.timezone,
      title: row.title,
    };
  });
}

export async function createConsultationLink(
  currentUser: CurrentUserContext,
  input: CreateConsultationLinkInput,
): Promise<CreateConsultationLinkResult> {
  const meetingUrlEncrypted = encryptMeetingUrl(input.meetingUrl);
  const screeningContext = {
    action: "link_create" as const,
    actorWallet: currentUser.wallet_address,
    dealId: null,
  };
  const screeningResult = await screenWalletForDeal(
    currentUser.wallet_address,
    screeningContext,
  );

  assertCompliance(screeningResult, screeningResult.walletAddress, screeningContext);

  for (let attempt = 0; attempt < LINK_HASH_INSERT_RETRY_COUNT; attempt += 1) {
    const linkHash = assertLinkHash(generateLinkHash());

    try {
      const createdLink = await createLink({
        creatorUserId: currentUser.id,
        description: input.description,
        durationMinutes: input.durationMinutes,
        expertAddress: currentUser.wallet_address,
        expiresAt: input.expiresAt,
        linkHash,
        meetingUrlEncrypted,
        priceUsdc: input.priceUsdc,
        scheduledAt: input.scheduledAt,
        status: "Open",
        timezone: input.timezone,
        title: input.title,
      });

      return {
        id: createdLink.id,
        link_hash: createdLink.link_hash,
        share_url: `/link/${createdLink.id}`,
        status: "Open",
      };
    } catch (error) {
      if (
        error instanceof ConsultationLinksRepositoryError &&
        error.code === "23505" &&
        attempt < LINK_HASH_INSERT_RETRY_COUNT - 1
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new ConsultationLinkServiceError(
    "Failed to generate a unique link hash.",
    409,
    "LINK_HASH_COLLISION",
  );
}

export async function getPublicConsultationLinkById(
  id: string,
  now: Date = new Date(),
): Promise<PublicConsultationLinkResult> {
  let link: ConsultationLinkRow | null;

  try {
    link = await getById(id);
  } catch (error) {
    if (error instanceof ConsultationLinksRepositoryError) {
      throw new ConsultationLinkServiceError(
        "Failed to load consultation link.",
        500,
        error.code ?? "LINK_LOAD_FAILED",
      );
    }

    if (isEconnresetLike(error)) {
      console.warn("Supabase cold start detected (ECONNRESET)", {
        code: error.code ?? "ECONNRESET",
        operation: "getPublicConsultationLinkById.getById",
      });
    }

    throw error;
  }

  if (!link) {
    throw new ConsultationLinkServiceError(
      "Link not found.",
      404,
      "LINK_NOT_FOUND",
      "unavailable",
    );
  }

  const publicStatus = resolvePublicStatus(link, now);

  if (publicStatus === "Draft") {
    throw new ConsultationLinkServiceError(
      "Link not found.",
      404,
      "LINK_NOT_FOUND",
      "unavailable",
    );
  }

  let existingDeal: Awaited<ReturnType<typeof getByConsultationLinkId>> = null;

  try {
    existingDeal = await getByConsultationLinkId(link.id);
  } catch (error) {
    if (error instanceof DealsRepositoryError) {
      throw new ConsultationLinkServiceError(
        "Failed to load consultation link.",
        500,
        error.code ?? "DEAL_LOAD_FAILED",
      );
    }

    if (isEconnresetLike(error)) {
      console.warn("Supabase cold start detected (ECONNRESET)", {
        code: error.code ?? "ECONNRESET",
        operation: "getPublicConsultationLinkById.getByConsultationLinkId",
      });
    }

    throw error;
  }

  if (existingDeal) {
    return mapPublicLink(link, "Consumed", existingDeal.id);
  }

  if (publicStatus === "Expired" || publicStatus === "Cancelled") {
    throw createUnavailableLinkError(publicStatus);
  }

  return mapPublicLink(
    link,
    publicStatus,
    null,
  );
}

export async function cancelConsultationLink(
  currentUser: CurrentUserContext,
  id: string,
): Promise<CancelConsultationLinkResult> {
  let link;

  try {
    link = await getById(id);
  } catch (error) {
    if (error instanceof ConsultationLinksRepositoryError) {
      throw new ConsultationLinkServiceError(
        "Failed to load consultation link.",
        500,
        error.code ?? "LINK_LOAD_FAILED",
      );
    }

    if (isEconnresetLike(error)) {
      console.warn("Supabase cold start detected (ECONNRESET)", {
        code: error.code ?? "ECONNRESET",
        operation: "cancelConsultationLink.getById",
      });
    }

    throw error;
  }

  if (!link) {
    throw new ConsultationLinkServiceError(
      "Link not found.",
      404,
      "LINK_NOT_FOUND",
    );
  }

  if (!isSameWallet(currentUser.wallet_address, link.expert_address)) {
    throw new ConsultationLinkServiceError(
      "Access denied.",
      403,
      "NOT_LINK_OWNER",
    );
  }

  try {
    await updateStatus(link.id, "Cancelled");
  } catch (error) {
    if (
      error instanceof ConsultationLinksRepositoryError &&
      error.code === "INVALID_STATUS_TRANSITION"
    ) {
      throw new ConsultationLinkServiceError(
        "Link cannot be cancelled in its current state.",
        409,
        "LINK_NOT_CANCELLABLE",
      );
    }

    if (
      error instanceof ConsultationLinksRepositoryError &&
      error.code === "LINK_NOT_FOUND"
    ) {
      throw new ConsultationLinkServiceError(
        "Link not found.",
        404,
        "LINK_NOT_FOUND",
      );
    }

    if (error instanceof ConsultationLinksRepositoryError) {
      throw new ConsultationLinkServiceError(
        "Failed to cancel consultation link.",
        500,
        error.code ?? "LINK_CANCEL_FAILED",
      );
    }

    if (isEconnresetLike(error)) {
      console.warn("Supabase cold start detected (ECONNRESET)", {
        code: error.code ?? "ECONNRESET",
        operation: "cancelConsultationLink.updateStatus",
      });
    }

    throw error;
  }

  return {
    ok: true,
    status: "Cancelled",
  };
}
