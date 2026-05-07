import type {
  SecurityRequestAttemptInsert,
  SecurityRequestAttemptRow,
  SecurityRequestAttemptScope,
} from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";

function mustBeUtcDate(value: Date): string {
  return value.toISOString();
}

export async function deleteExpiredSecurityRequestAttempts(
  scope: SecurityRequestAttemptScope,
  olderThan: Date,
): Promise<void> {
  const db = getServerDbClient().schema("public");
  const { error } = await db
    .from("security_request_attempts")
    .delete()
    .eq("scope", scope)
    .lt("created_at", mustBeUtcDate(olderThan));

  if (error) {
    throw new Error(`Failed to delete expired security request attempts: ${error.message}`);
  }
}

export async function countRecentSecurityRequestAttempts(input: {
  scope: SecurityRequestAttemptScope;
  walletAddress: string;
  dealId?: string;
  since: Date;
}): Promise<number> {
  const db = getServerDbClient().schema("public");
  let query = db
    .from("security_request_attempts")
    .select("id", { count: "exact", head: true })
    .eq("scope", input.scope)
    .eq("wallet_address", input.walletAddress)
    .gte("created_at", mustBeUtcDate(input.since));

  query = input.dealId
    ? query.eq("deal_id", input.dealId)
    : query.is("deal_id", null);

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to count security request attempts: ${error.message}`);
  }

  if (count === null) {
    throw new Error("Failed to count security request attempts: count was not returned.");
  }

  return count;
}

export async function createSecurityRequestAttempt(input: {
  scope: SecurityRequestAttemptScope;
  walletAddress: string;
  dealId?: string;
}): Promise<SecurityRequestAttemptRow> {
  const db = getServerDbClient().schema("public");
  const payload: SecurityRequestAttemptInsert = {
    scope: input.scope,
    wallet_address: input.walletAddress,
    deal_id: input.dealId ?? null,
  };

  const { data, error } = await db
    .from("security_request_attempts")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create security request attempt: ${error.message}`);
  }

  return data as SecurityRequestAttemptRow;
}
