import type {
  ConsultationLinkRow,
  Database,
} from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";

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
  gracePeriodMinutes: number;
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
    grace_period_minutes: input.gracePeriodMinutes,
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
