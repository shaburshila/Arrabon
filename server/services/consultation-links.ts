import "server-only";

import { getAddress } from "viem";

import type { CurrentUserContext } from "@/lib/auth/guards";
import type { ConsultationLinkRow, ConsultationLinkStatus } from "@/lib/db/types";
import { encryptMeetingUrl } from "@/lib/crypto/meeting-url";
import { assertLinkHash, generateLinkHash } from "@/lib/crypto/link-hash";
import type { CreateConsultationLinkInput } from "@/lib/validators/consultation-links";
import {
  ConsultationLinksRepositoryError,
  createLink,
  getById,
  updateStatus,
} from "@/server/repositories/consultation-links";

const LINK_HASH_INSERT_RETRY_COUNT = 3;

type PublicUnavailableStatus = "Cancelled" | "Consumed" | "Expired";

export interface CreateConsultationLinkResult {
  id: string;
  link_hash: string;
  share_url: string;
  status: "Open";
}

export interface PublicConsultationLinkResult {
  description: string;
  duration_minutes: number;
  expires_at: string;
  grace_period_minutes: number;
  id: string;
  meeting_url_revealed: false;
  price_usdc: string;
  scheduled_at: string;
  seller_address: string;
  status: "Open";
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
  if (row.status === "Open" && new Date(row.expires_at).getTime() < now.getTime()) {
    return "Expired";
  }

  return row.status;
}

function isSameWallet(left: string, right: string): boolean {
  return getAddress(left) === getAddress(right);
}

function mapPublicLink(row: ConsultationLinkRow): PublicConsultationLinkResult {
  return {
    description: row.description,
    duration_minutes: row.duration_minutes,
    expires_at: row.expires_at,
    grace_period_minutes: row.grace_period_minutes,
    id: row.id,
    meeting_url_revealed: false,
    price_usdc: String(row.price_usdc),
    scheduled_at: row.scheduled_at,
    seller_address: row.expert_address,
    status: "Open",
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
    case "Consumed":
      return new ConsultationLinkServiceError("Link has already been consumed.", 410, "LINK_CONSUMED", statusValue);
  }
}

export async function createConsultationLink(
  currentUser: CurrentUserContext,
  input: CreateConsultationLinkInput,
): Promise<CreateConsultationLinkResult> {
  const meetingUrlEncrypted = encryptMeetingUrl(input.meetingUrl);

  for (let attempt = 0; attempt < LINK_HASH_INSERT_RETRY_COUNT; attempt += 1) {
    const linkHash = assertLinkHash(generateLinkHash());

    try {
      const createdLink = await createLink({
        creatorUserId: currentUser.id,
        description: input.description,
        durationMinutes: input.durationMinutes,
        expertAddress: currentUser.wallet_address,
        expiresAt: input.expiresAt,
        gracePeriodMinutes: input.gracePeriodMinutes,
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
  const link = await getById(id);

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

  if (publicStatus !== "Open") {
    throw createUnavailableLinkError(publicStatus);
  }

  return mapPublicLink(link);
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

    throw error;
  }

  return {
    ok: true,
    status: "Cancelled",
  };
}
