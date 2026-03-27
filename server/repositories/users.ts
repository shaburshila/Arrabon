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
  const existingUser = await getByWallet(wallet);

  if (existingUser) {
    return existingUser;
  }

  try {
    return await createUser(wallet);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("duplicate key") || error.message.includes("23505"))
    ) {
      const user = await getByWallet(wallet);

      if (user) {
        return user;
      }
    }

    throw error;
  }
}
