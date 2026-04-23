import type { AuthNonceInsert, AuthNonceRow } from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";

function mustBeUtcDate(value: Date): string {
  return value.toISOString();
}

export async function createNonce(
  wallet: string,
  nonce: string,
  expiresAt: Date,
): Promise<AuthNonceRow> {
  const db = getServerDbClient();
  const payload: AuthNonceInsert = {
    wallet,
    nonce,
    expires_at: mustBeUtcDate(expiresAt),
  };

  const { data, error } = await db
    .from("auth_nonces")
    .insert(payload as never)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create auth nonce: ${error.message}`);
  }

  return data as AuthNonceRow;
}

export async function countRecentNonces(wallet: string, since: Date): Promise<number> {
  const db = getServerDbClient();
  const { count, error } = await db
    .from("auth_nonces")
    .select("id", { count: "exact", head: true })
    .eq("wallet", wallet)
    .gte("created_at", mustBeUtcDate(since));

  if (error) {
    throw new Error(`Failed to count recent auth nonces: ${error.message}`);
  }

  if (count === null) {
    throw new Error("Failed to count recent auth nonces: count was not returned.");
  }

  return count;
}

export async function invalidateActiveNonces(wallet: string, now: Date): Promise<void> {
  const db = getServerDbClient();
  const { error } = await db
    .from("auth_nonces")
    .update({ used_at: mustBeUtcDate(now) } as never)
    .eq("wallet", wallet)
    .is("used_at", null)
    .gt("expires_at", mustBeUtcDate(now));

  if (error) {
    throw new Error(`Failed to invalidate active auth nonces: ${error.message}`);
  }
}

export async function deleteExpiredNonces(now: Date): Promise<void> {
  const db = getServerDbClient();
  const { error } = await db
    .from("auth_nonces")
    .delete()
    .lte("expires_at", mustBeUtcDate(now));

  if (error) {
    throw new Error(`Failed to delete expired auth nonces: ${error.message}`);
  }
}

export async function getValidNonce(
  wallet: string,
  nonce: string,
): Promise<AuthNonceRow | null> {
  const db = getServerDbClient();
  const nowUtc = new Date().toISOString();
  const { data, error } = await db
    .from("auth_nonces")
    .select("*")
    .eq("wallet", wallet)
    .eq("nonce", nonce)
    .is("used_at", null)
    .gt("expires_at", nowUtc)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load auth nonce: ${error.message}`);
  }

  return data as AuthNonceRow | null;
}

export async function markUsed(id: string): Promise<AuthNonceRow | null> {
  const db = getServerDbClient();
  const { data, error } = await db
    .from("auth_nonces")
    .update({ used_at: new Date().toISOString() } as never)
    .eq("id", id)
    .is("used_at", null)
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to mark auth nonce as used: ${error.message}`);
  }

  return (data as AuthNonceRow | null) ?? null;
}
