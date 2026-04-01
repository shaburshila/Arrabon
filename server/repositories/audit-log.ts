import type {
  AuditLogInsert,
  AuditLogRow,
} from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";

export class AuditLogRepositoryError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "AuditLogRepositoryError";
    this.code = code;
  }
}

export interface CreateAuditLogEntryInput {
  action: string;
  actorAddress: string | null;
  entityId: string;
  entityType: string;
  metadata?: Record<string, unknown>;
}

export async function createAuditLogEntry(
  input: CreateAuditLogEntryInput,
): Promise<AuditLogRow> {
  const db = getServerDbClient().schema("public");
  const payload: AuditLogInsert = {
    action: input.action,
    actor_address: input.actorAddress,
    entity_id: input.entityId,
    entity_type: input.entityType,
    metadata: input.metadata ?? {},
  };

  const { data, error } = await db
    .from("audit_log")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new AuditLogRepositoryError(
      `Failed to create audit log entry: ${error.message}`,
      error.code,
    );
  }

  return data;
}
