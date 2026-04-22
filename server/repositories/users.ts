import type { UserInsert, UserRow } from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";

export type UsersRepositoryErrorCode = "USER_GET_OR_CREATE_FAILED";

export class UsersRepositoryError extends Error {
  code: UsersRepositoryErrorCode;

  constructor(message: string, code: UsersRepositoryErrorCode, options?: ErrorOptions) {
    super(message, options);
    this.name = "UsersRepositoryError";
    this.code = code;
  }
}

export async function getByWallet(wallet: string): Promise<UserRow | null> {
  const db = getServerDbClient();
  const { data, error } = await db
    .from("users")
    .select("*")
    .eq("wallet", wallet)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load user by wallet: ${error.message}`);
  }

  return data as UserRow | null;
}

export async function createUser(wallet: string): Promise<UserRow> {
  const db = getServerDbClient().schema("public");
  const payload: UserInsert = {
    wallet,
  };

  const { data, error } = await db
    .from("users")
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }

  return data as UserRow;
}

export async function getOrCreateUser(wallet: string): Promise<UserRow> {
  const db = getServerDbClient().schema("public");
  const payload: UserInsert = {
    wallet,
  };

  const { data, error } = await db
    .from("users")
    .upsert(payload, { onConflict: "wallet" })
    .select("*")
    .single();

  if (error) {
    throw new UsersRepositoryError(
      `Failed to get or create user: ${error.message}`,
      "USER_GET_OR_CREATE_FAILED",
      { cause: error },
    );
  }

  return data as UserRow;
}
