import "server-only";

import type { WalletDenylistRow } from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";

export class WalletDenylistRepositoryError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "WalletDenylistRepositoryError";
    this.code = code;
  }
}

function normalizeWallet(wallet: string): string {
  return wallet.trim().toLowerCase();
}

export async function findByWallet(wallet: string): Promise<WalletDenylistRow | null> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("wallet_denylist")
    .select("*")
    .eq("wallet", normalizeWallet(wallet))
    .maybeSingle();

  if (error) {
    throw new WalletDenylistRepositoryError(
      `Failed to load denylist entry: ${error.message}`,
      error.code,
    );
  }

  return data;
}

export async function existsByWallet(wallet: string): Promise<boolean> {
  return (await findByWallet(wallet)) !== null;
}
