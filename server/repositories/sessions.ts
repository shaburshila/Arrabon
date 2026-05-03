import type { SessionInsert, SessionRow, SessionUpdate } from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";

function mustBeUtcDate(value: Date): string {
  return value.toISOString();
}

export async function createSession(
  wallet: string,
  isAdmin: boolean,
  tokenHash: string,
  expiresAt: Date,
): Promise<SessionRow> {
  const db = getServerDbClient().schema("public");
  const payload: SessionInsert = {
    is_admin: isAdmin,
    wallet,
    session_token_hash: tokenHash,
    expires_at: mustBeUtcDate(expiresAt),
  };

  const { data, error } = await db
    .from("sessions")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return data as SessionRow;
}

export async function getSession(tokenHash: string): Promise<SessionRow | null> {
  const db = getServerDbClient().schema("public");
  const nowUtc = new Date().toISOString();
  const { data, error } = await db
    .from("sessions")
    .select("*")
    .eq("session_token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", nowUtc)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load session: ${error.message}`);
  }

  return data as SessionRow | null;
}

export async function revokeSession(id: string): Promise<SessionRow | null> {
  const db = getServerDbClient().schema("public");
  const payload: SessionUpdate = {
    revoked_at: new Date().toISOString(),
  };
  const { data, error } = await db
    .from("sessions")
    .update(payload)
    .eq("id", id)
    .is("revoked_at", null)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to revoke session: ${error.message}`);
  }

  return (data as SessionRow | null) ?? null;
}
