import type { UserInsert, UserRow } from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";

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
  const db = getServerDbClient();
  const payload: UserInsert = {
    wallet,
  };

  const { data, error } = await db
    .from("users")
    .insert(payload as never)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }

  return data as UserRow;
}
