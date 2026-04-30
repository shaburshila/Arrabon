import type {
  ConsultationLinkRow,
  Database,
} from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";
import {
  normalizeListPagination,
  type ListPagination,
} from "@/lib/validators/pagination";

type ConsultationLinksTable =
  Database["public"]["Tables"]["consultation_links"];
type ConsultationLinkInsert = ConsultationLinksTable["Insert"];

export class ConsultationLinksRepositoryError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ConsultationLinksRepositoryError";
    this.code = code;
  }
}

const TERMINAL_LINK_STATUSES: ReadonlySet<ConsultationLinkRow["status"]> = new Set([
  "Cancelled",
  "Consumed",
  "Expired",
]);

const ALLOWED_STATUS_TRANSITIONS: Readonly<Record<ConsultationLinkRow["status"], readonly ConsultationLinkRow["status"][]>> = {
  Cancelled: [],
  Consumed: [],
  Draft: ["Cancelled", "Open"],
  Expired: [],
  Open: ["Cancelled", "Consumed", "Expired"],
};

export interface CreateConsultationLinkInput {
  creatorUserId: string;
  expertAddress: string;
  title: string;
  description: string;
  priceUsdc: string;
  scheduledAt: Date;
  timezone: string;
  expiresAt: Date;
  durationMinutes: number;
  meetingUrlEncrypted: string;
  linkHash: string;
  status: ConsultationLinkRow["status"];
}

function toUtcIsoString(value: Date): string {
  return value.toISOString();
}

export async function createLink(
  input: CreateConsultationLinkInput,
): Promise<ConsultationLinkRow> {
  const db = getServerDbClient().schema("public");
  const payload: ConsultationLinkInsert = {
    creator_user_id: input.creatorUserId,
    expert_address: input.expertAddress,
    title: input.title,
    description: input.description,
    price_usdc: input.priceUsdc,
    scheduled_at: toUtcIsoString(input.scheduledAt),
    timezone: input.timezone,
    expires_at: toUtcIsoString(input.expiresAt),
    duration_minutes: input.durationMinutes,
    meeting_url_encrypted: input.meetingUrlEncrypted,
    link_hash: input.linkHash,
    status: input.status,
  };

  const { data, error } = await db
    .from("consultation_links")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new ConsultationLinksRepositoryError(
      `Failed to create consultation link: ${error.message}`,
      error.code,
    );
  }

  return data;
}

export async function getById(id: string): Promise<ConsultationLinkRow | null> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("consultation_links")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new ConsultationLinksRepositoryError(
      `Failed to load consultation link: ${error.message}`,
      error.code,
    );
  }

  return data;
}

export async function getByIds(ids: readonly string[]): Promise<ConsultationLinkRow[]> {
  if (ids.length === 0) {
    return [];
  }

  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("consultation_links")
    .select("*")
    .in("id", [...ids]);

  if (error) {
    throw new ConsultationLinksRepositoryError(
      `Failed to load consultation links by ids: ${error.message}`,
      error.code,
    );
  }

  return data ?? [];
}

export async function getByCreatorUserId(
  creatorUserId: string,
  pagination?: Partial<ListPagination>,
): Promise<ConsultationLinkRow[]> {
  const { limit, offset } = normalizeListPagination(pagination);
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("consultation_links")
    .select("*")
    .eq("creator_user_id", creatorUserId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new ConsultationLinksRepositoryError(
      `Failed to load consultation links: ${error.message}`,
      error.code,
    );
  }

  return data ?? [];
}

export async function getAllByCreatorUserId(
  creatorUserId: string,
): Promise<ConsultationLinkRow[]> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("consultation_links")
    .select("*")
    .eq("creator_user_id", creatorUserId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new ConsultationLinksRepositoryError(
      `Failed to load consultation links: ${error.message}`,
      error.code,
    );
  }

  return data ?? [];
}

export async function getByLinkHash(
  linkHash: string,
): Promise<ConsultationLinkRow | null> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("consultation_links")
    .select("*")
    .eq("link_hash", linkHash)
    .maybeSingle();

  if (error) {
    throw new ConsultationLinksRepositoryError(
      `Failed to load consultation link by link hash: ${error.message}`,
      error.code,
    );
  }

  return data;
}

export async function updateStatus(
  id: string,
  status: ConsultationLinkRow["status"],
): Promise<ConsultationLinkRow> {
  const db = getServerDbClient().schema("public");
  const currentLink = await getById(id);

  if (!currentLink) {
    throw new ConsultationLinksRepositoryError(
      `Consultation link not found: ${id}`,
      "LINK_NOT_FOUND",
    );
  }

  if (currentLink.status === status) {
    return currentLink;
  }

  if (TERMINAL_LINK_STATUSES.has(currentLink.status)) {
    throw new ConsultationLinksRepositoryError(
      `Cannot transition consultation link from terminal status ${currentLink.status} to ${status}.`,
      "INVALID_STATUS_TRANSITION",
    );
  }

  const allowedNextStatuses = ALLOWED_STATUS_TRANSITIONS[currentLink.status];

  if (!allowedNextStatuses.includes(status)) {
    throw new ConsultationLinksRepositoryError(
      `Invalid consultation link status transition: ${currentLink.status} -> ${status}.`,
      "INVALID_STATUS_TRANSITION",
    );
  }

  const { data, error } = await db
    .from("consultation_links")
    .update({ status })
    .eq("id", id)
    .eq("status", currentLink.status)
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      const refreshedLink = await getById(id);

      if (refreshedLink?.status === status) {
        return refreshedLink;
      }
    }

    throw new ConsultationLinksRepositoryError(
      `Failed to update consultation link status: ${error.message}`,
      error.code,
    );
  }

  if (!data) {
    throw new ConsultationLinksRepositoryError(
      `Failed to update consultation link status for ${id}.`,
      "STATUS_UPDATE_FAILED",
    );
  }

  return data;
}
